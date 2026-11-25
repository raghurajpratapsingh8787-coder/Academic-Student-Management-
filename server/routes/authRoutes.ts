import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db, getStorageMode } from '../db/store';
import { authenticate, verifyCookieMutationOrigin } from '../middleware/auth';
import { seedSampleAcademicData } from '../services/seedService';
import {
  generateRandomToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from '../utils/crypto';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  setupAdminSchema,
  updateProfileSchema,
} from '../validators/schemas';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes and try again.' },
});

const REFRESH_COOKIE_NAME = 'acadex_rt';

function setRefreshCookie(req: Request, res: Response, rawToken: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAgeSec = 7 * 24 * 60 * 60;
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/api/auth',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearRefreshCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [`${REFRESH_COOKIE_NAME}=`, 'Path=/api/auth', 'Max-Age=0', 'HttpOnly'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function safeAdminView(admin: Awaited<ReturnType<typeof db.findAdminById>>) {
  if (!admin) return null;
  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    avatarUrl: admin.avatarUrl,
    departmentId: admin.departmentId,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
  };
}

router.get('/status', async (req, res, next) => {
  try {
    const count = await db.countAdmins();
    const hasSession = Boolean(req.cookies?.[REFRESH_COOKIE_NAME]);
    res.json({
      needsSetup: count === 0,
      hasSession,
      storageMode: getStorageMode(),
    });
  } catch (err) {
    next(err);
  }
});

let setupInProgress = false;

/**
 * One-time first-run Super Admin bootstrap route.
 * Permanently locks once at least one admin account exists in the database.
 */
router.post('/setup', authLimiter, async (req, res, next) => {
  if (setupInProgress) {
    res.status(409).json({ error: 'Initial administrator setup is already in progress.' });
    return;
  }
  setupInProgress = true;
  try {
    const existingCount = await db.countAdmins();
    if (existingCount > 0) {
      res.status(403).json({ error: 'Initial administrator setup has already been completed.' });
      return;
    }

    const parsed = setupAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid setup payload' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    if ((await db.countAdmins()) > 0) {
      res.status(403).json({ error: 'Initial administrator setup has already been completed.' });
      return;
    }
    const admin = await db.createAdmin({
      name: parsed.data.name,
      email: parsed.data.email,
      role: 'SUPER_ADMIN',
      passwordHash,
      avatarUrl: '/src/assets/images/avatar_admin_director_1795587460700.jpg',
      departmentId: null,
      isActive: true,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      lastLoginAt: new Date().toISOString(),
    });

    if (parsed.data.seedSampleData) {
      await seedSampleAcademicData(admin._id, admin.email);
    }

    const rawRefresh = generateRandomToken();
    await db.createSession({
      userId: admin._id,
      tokenHash: hashToken(rawRefresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 200),
      ip: req.ip || '',
    });

    setRefreshCookie(req, res, rawRefresh);
    const accessToken = signAccessToken({
      sub: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    await db.logAudit({
      actorId: admin._id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'ADMIN_BOOTSTRAP',
      entityType: 'Admin',
      entityId: admin._id,
      summary: `Initial Super Admin account claimed by ${admin.email}`,
      ip: req.ip || '',
    });

    res.status(201).json({
      accessToken,
      user: safeAdminView(admin),
    });
  } catch (err) {
    next(err);
  } finally {
    setupInProgress = false;
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials' });
      return;
    }

    const admin = await db.findAdminByEmail(parsed.data.email);
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await verifyPassword(parsed.data.password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    await db.updateAdmin(admin._id, { lastLoginAt: new Date().toISOString() });

    const rawRefresh = generateRandomToken();
    await db.createSession({
      userId: admin._id,
      tokenHash: hashToken(rawRefresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 200),
      ip: req.ip || '',
    });

    setRefreshCookie(req, res, rawRefresh);
    const accessToken = signAccessToken({
      sub: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    await db.logAudit({
      actorId: admin._id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'LOGIN',
      entityType: 'Session',
      entityId: admin._id,
      summary: `${admin.email} signed in`,
      ip: req.ip || '',
    });

    res.json({
      accessToken,
      user: safeAdminView(admin),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', verifyCookieMutationOrigin, async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== 'string') {
      res.status(401).json({ error: 'No active session' });
      return;
    }

    const session = await db.findSessionByTokenHash(hashToken(rawToken));
    if (!session) {
      clearRefreshCookie(req, res);
      res.status(401).json({ error: 'Session not recognized' });
      return;
    }

    if (session.revokedAt) {
      // Refresh token reuse detected -> revoke all sessions for this user
      await db.revokeAllUserSessions(session.userId);
      clearRefreshCookie(req, res);
      res.status(401).json({ error: 'Session revoked for security' });
      return;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await db.revokeSession(session._id);
      clearRefreshCookie(req, res);
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    const admin = await db.findAdminById(session.userId);
    if (!admin || !admin.isActive) {
      await db.revokeSession(session._id);
      clearRefreshCookie(req, res);
      res.status(401).json({ error: 'Account unavailable' });
      return;
    }

    // Rotate refresh token
    await db.revokeSession(session._id);
    const nextRawRefresh = generateRandomToken();
    await db.createSession({
      userId: admin._id,
      tokenHash: hashToken(nextRawRefresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 200),
      ip: req.ip || '',
    });

    setRefreshCookie(req, res, nextRawRefresh);
    const accessToken = signAccessToken({
      sub: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    res.json({
      accessToken,
      user: safeAdminView(admin),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', verifyCookieMutationOrigin, async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken && typeof rawToken === 'string') {
      const session = await db.findSessionByTokenHash(hashToken(rawToken));
      if (session) {
        await db.revokeSession(session._id);
      }
    }
    clearRefreshCookie(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid email' });
      return;
    }
    const admin = await db.findAdminByEmail(parsed.data.email);
    if (admin && admin.isActive) {
      const resetToken = generateRandomToken();
      await db.updateAdmin(admin._id, {
        resetTokenHash: hashToken(resetToken),
        resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      await db.logAudit({
        actorId: admin._id,
        actorEmail: admin.email,
        actorRole: admin.role,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'Admin',
        entityId: admin._id,
        summary: `Password reset requested for ${admin.email}`,
        ip: req.ip || '',
      });
      // Token is intentionally never exposed in HTTP response to avoid unauthenticated account takeover.
      console.info(`[Auth] Password reset token issued for ${admin.email} (expires in 30m)`);
    }
    res.json({
      message: 'If an active administrator account matches that email, reset instructions have been issued.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset request' });
      return;
    }

    const admin = await db.findAdminByResetTokenHash(hashToken(parsed.data.token));
    if (!admin) {
      res.status(400).json({ error: 'Reset token is invalid or has expired' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await db.updateAdmin(admin._id, {
      passwordHash,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });
    await db.revokeAllUserSessions(admin._id);

    await db.logAudit({
      actorId: admin._id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'Admin',
      entityId: admin._id,
      summary: `Password reset completed for ${admin.email}`,
      ip: req.ip || '',
    });

    res.json({ message: 'Password updated successfully. Please sign in with your new credentials.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const admin = await db.findAdminById(req.user!.id);
    if (!admin) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: safeAdminView(admin) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile input' });
      return;
    }
    const updated = await db.updateAdmin(req.user!.id, { name: parsed.data.name });
    res.json({ user: safeAdminView(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password input' });
      return;
    }
    const admin = await db.findAdminById(req.user!.id);
    if (!admin) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const ok = await verifyPassword(parsed.data.currentPassword, admin.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.updateAdmin(admin._id, { passwordHash });
    await db.revokeAllUserSessions(admin._id);

    const nextRawRefresh = generateRandomToken();
    await db.createSession({
      userId: admin._id,
      tokenHash: hashToken(nextRawRefresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 200),
      ip: req.ip || '',
    });
    setRefreshCookie(req, res, nextRawRefresh);

    await db.logAudit({
      actorId: admin._id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'Admin',
      entityId: admin._id,
      summary: `${admin.email} updated their password`,
      ip: req.ip || '',
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;

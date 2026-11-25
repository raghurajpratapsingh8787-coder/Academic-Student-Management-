import express from 'express';
import { db } from '../db/store';
import { authenticate, requireRole } from '../middleware/auth';
import { computeAttendanceSummary, computeOverviewMetrics } from '../utils/analyticsMath';
import { generateRandomToken, hashPassword, hashToken } from '../utils/crypto';
import { createAdminSchema, updateAdminSchema, updateSettingsSchema } from '../validators/schemas';

const router = express.Router();

router.use(authenticate);

router.get('/analytics/overview', async (req, res, next) => {
  try {
    const [allStudents, departments, courses, auditLogs] = await Promise.all([
      db.listAllStudents(),
      db.listDepartments(),
      db.listCourses(),
      db.listAuditLogs({ limit: 12 }),
    ]);

    const scopedStudents =
      req.user!.role === 'STAFF' && req.user!.departmentId
        ? allStudents.filter((s) => s.departmentId === req.user!.departmentId)
        : allStudents;

    const metrics = computeOverviewMetrics(scopedStudents, departments, courses);
    const recentStudents = [...scopedStudents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((s) => ({
        _id: s._id,
        studentId: s.studentId,
        fullName: s.fullName,
        status: s.status,
        enrollmentDate: s.enrollmentDate,
        profilePhoto: s.profilePhoto,
        departmentName: departments.find((d) => d._id === s.departmentId)?.name || 'Unassigned',
      }));

    const visibleActivities =
      req.user!.role === 'STAFF'
        ? auditLogs.filter(
            (log) => !log.action.startsWith('ADMIN_') && !log.action.startsWith('SETTINGS_')
          )
        : auditLogs;

    res.json({
      ...metrics,
      recentStudents,
      recentActivities: visibleActivities,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/reports', async (req, res, next) => {
  try {
    const q = req.query;
    const scopedDeptId =
      req.user!.role === 'STAFF' && req.user!.departmentId
        ? req.user!.departmentId
        : typeof q.departmentId === 'string'
        ? q.departmentId
        : undefined;

    const [allStudents, departments, courses, attendance] = await Promise.all([
      db.listAllStudents(),
      db.listDepartments(),
      db.listCourses(),
      db.listAttendance({
        departmentId: scopedDeptId,
        courseId: typeof q.courseId === 'string' ? q.courseId : undefined,
        month: typeof q.month === 'string' ? q.month : undefined,
      }),
    ]);

    let students = allStudents;
    if (scopedDeptId) students = students.filter((s) => s.departmentId === scopedDeptId);
    if (typeof q.courseId === 'string' && q.courseId) {
      students = students.filter((s) => s.courseId === q.courseId);
    }
    if (typeof q.status === 'string' && q.status) {
      students = students.filter((s) => s.status === q.status);
    }

    const overview = computeOverviewMetrics(students, departments, courses);
    const attendanceSummary = computeAttendanceSummary(students, attendance, departments, courses);

    const courseBreakdown = courses
      .filter((c) => !scopedDeptId || c.departmentId === scopedDeptId)
      .map((c) => {
        const enrolled = students.filter((s) => s.courseId === c._id);
        const dept = departments.find((d) => d._id === c.departmentId);
        return {
          courseId: c._id,
          courseCode: c.code,
          courseName: c.name,
          departmentName: dept?.name || 'Unassigned',
          totalStudents: enrolled.length,
          activeStudents: enrolled.filter((s) => s.status === 'ACTIVE').length,
          inactiveStudents: enrolled.filter((s) => s.status !== 'ACTIVE').length,
        };
      });

    res.json({
      overview,
      courseBreakdown,
      attendanceSummary,
      students: students.map((s) => ({
        ...s,
        departmentName: departments.find((d) => d._id === s.departmentId)?.name || 'Unassigned',
        courseName: courses.find((c) => c._id === s.courseId)?.name || 'Unassigned',
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------- NOTIFICATIONS ----------------
router.get('/notifications', async (req, res, next) => {
  try {
    const items = await db.listNotifications();
    const mapped = items.map((n) => ({
      ...n,
      read: n.readBy.includes(req.user!.id),
    }));
    res.json({ items: mapped, unreadCount: mapped.filter((n) => !n.read).length });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    await db.markNotificationRead(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/read-all', async (req, res, next) => {
  try {
    await db.markAllNotificationsRead(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------- AUDIT LOGS ----------------
router.get('/audit-logs', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const items = await db.listAuditLogs({ limit });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ---------------- ADMIN MANAGEMENT (SUPER_ADMIN ONLY) ----------------
router.get('/admins', requireRole('SUPER_ADMIN'), async (_req, res, next) => {
  try {
    const admins = await db.listAdmins();
    res.json({
      items: admins.map((a) => ({
        id: a._id,
        name: a.name,
        email: a.email,
        role: a.role,
        avatarUrl: a.avatarUrl,
        departmentId: a.departmentId,
        isActive: a.isActive,
        lastLoginAt: a.lastLoginAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admins', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid administrator input' });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const created = await db.createAdmin({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
      avatarUrl: '',
      departmentId: parsed.data.departmentId || null,
      isActive: true,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      lastLoginAt: null,
    });

    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ADMIN_CREATED',
      entityType: 'Admin',
      entityId: created._id,
      summary: `Provisioned ${created.role} account for ${created.email}`,
      ip: req.ip || '',
    });

    res.status(201).json({
      admin: {
        id: created._id,
        name: created.name,
        email: created.email,
        role: created.role,
        departmentId: created.departmentId,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/admins/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const parsed = updateAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid administrator update' });
      return;
    }
    if (req.params.id === req.user!.id && parsed.data.isActive === false) {
      res.status(400).json({ error: 'You cannot deactivate your own active Super Admin account' });
      return;
    }
    if (req.params.id === req.user!.id && parsed.data.role && parsed.data.role !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'You cannot demote your own Super Admin role' });
      return;
    }

    const updated = await db.updateAdmin(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Administrator not found' });
      return;
    }

    if (parsed.data.isActive === false) {
      await db.revokeAllUserSessions(updated._id);
    }

    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ADMIN_UPDATED',
      entityType: 'Admin',
      entityId: updated._id,
      summary: `Updated role/access for ${updated.email} (${updated.role})`,
      ip: req.ip || '',
    });

    res.json({
      admin: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        departmentId: updated.departmentId,
        isActive: updated.isActive,
        lastLoginAt: updated.lastLoginAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admins/:id/reset-token', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const target = await db.findAdminById(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const rawToken = generateRandomToken();
    await db.updateAdmin(target._id, {
      resetTokenHash: hashToken(rawToken),
      resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ADMIN_RESET_TOKEN_ISSUED',
      entityType: 'Admin',
      entityId: target._id,
      summary: `Super Admin generated one-time password reset token for ${target.email}`,
      ip: req.ip || '',
    });
    res.json({ resetToken: rawToken, expiresInMinutes: 60 });
  } catch (err) {
    next(err);
  }
});

// ---------------- SETTINGS ----------------
router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await db.getSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings update' });
      return;
    }
    const settings = await db.updateSettings(parsed.data);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: 'default',
      summary: `Updated institutional settings for ${settings.institutionName}`,
      ip: req.ip || '',
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

export default router;

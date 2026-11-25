import { NextFunction, Request, Response } from 'express';
import { db } from '../db/store';
import { getAllowedOrigins } from '../config/env';
import { sanitizeNoSqlInput, UserRole, verifyAccessToken } from '../utils/crypto';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function sanitizeBodyAndQuery(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeNoSqlInput(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const clean = sanitizeNoSqlInput(req.query);
    for (const key of Object.keys(req.query)) {
      if (!(key in clean)) {
        delete (req.query as Record<string, unknown>)[key];
      }
    }
  }
  next();
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const payload = verifyAccessToken(token);
    const admin = await db.findAdminById(payload.sub);
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: 'Account inactive or not found' });
      return;
    }
    req.user = {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      departmentId: admin.departmentId,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this action' });
      return;
    }
    next();
  };
}

/**
 * Verifies same-origin or explicit CSRF custom header on cookie-authenticated mutations.
 */
export function verifyCookieMutationOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const xRequestedWith = req.headers['x-requested-with'];
  const allowed = getAllowedOrigins();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();

  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      res.status(403).json({ error: 'Invalid request origin' });
      return;
    }
    if (originHost === host || allowed.includes(origin)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Cross-origin request rejected' });
    return;
  }

  if (xRequestedWith === 'XMLHttpRequest') {
    next();
    return;
  }

  res.status(403).json({ error: 'Missing origin verification header' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const status = Number((err as { statusCode: number }).statusCode) || 400;
    const message = (err as { message?: string }).message || 'Request failed';
    res.status(status).json({ error: message });
    return;
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'MulterError') {
    const msg = err instanceof Error ? err.message : 'File upload failed';
    res.status(400).json({ error: msg });
    return;
  }
  console.error('[Server Error]', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'An unexpected internal error occurred' });
}

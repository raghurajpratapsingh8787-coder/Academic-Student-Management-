import crypto from 'crypto';
import path from 'path';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  type: 'access';
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.jwtSecret, {
    expiresIn: '15m',
    issuer: 'acadex-sms',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'acadex-sms' });
  if (typeof decoded !== 'object' || decoded === null || decoded.type !== 'access') {
    throw new Error('Invalid token payload');
  }
  return decoded as AccessTokenPayload;
}

export function generateRandomToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Recursively strips MongoDB operator keys ($-prefixed) and prototype pollution keys.
 */
export function sanitizeNoSqlInput<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeNoSqlInput(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('$') || k === '__proto__' || k === 'constructor' || k === 'prototype') {
        continue;
      }
      if (k.includes('.')) {
        continue;
      }
      clean[k] = sanitizeNoSqlInput(v);
    }
    return clean as T;
  }
  return value;
}

/**
 * Validates image file signatures via magic bytes instead of trusting MIME/extensions.
 */
export function detectImageSignature(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

export function resolveSafeFilePath(baseDir: string, filename: string): string | null {
  // Only allow strict safe alphanumeric/hyphen/extension filenames
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
    return null;
  }
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, filename);
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    return null;
  }
  return resolved;
}

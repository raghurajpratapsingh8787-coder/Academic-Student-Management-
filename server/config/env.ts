import crypto from 'crypto';
import path from 'path';

const runtimeJwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const runtimeRefreshSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');

export function normalizeMongoUri(raw?: string): string {
  if (!raw) return '';
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('`') && value.endsWith('`'))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (/^MONGODB_URI\s*=/i.test(value)) {
    value = value.replace(/^MONGODB_URI\s*=\s*/i, '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
  }
  if (/^mongodb\+srv:\/\//i.test(value)) {
    return 'mongodb+srv://' + value.slice('mongodb+srv://'.length);
  }
  if (/^mongodb:\/\//i.test(value)) {
    return 'mongodb://' + value.slice('mongodb://'.length);
  }
  return '';
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongodbUri: normalizeMongoUri(process.env.MONGODB_URI),
  jwtSecret: runtimeJwtSecret,
  jwtRefreshSecret: runtimeRefreshSecret,
  appUrl: (process.env.APP_URL || '').trim(),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  uploadDir: path.resolve(process.cwd(), '.uploads'),
  dataDir: path.resolve(process.cwd(), '.data'),
};

export function getAllowedOrigins(): string[] {
  const defaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
  ];
  if (env.appUrl && env.appUrl !== 'MY_APP_URL') {
    defaults.push(env.appUrl.replace(/\/$/, ''));
  }
  return Array.from(new Set([...defaults, ...env.corsOrigins]));
}

export function isOriginAllowed(
  origin: string | undefined,
  requestHost: string,
  allowedOrigins: string[]
): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (
      requestHost &&
      parsed.host === requestHost &&
      (parsed.protocol === 'https:' || parsed.protocol === 'http:')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}


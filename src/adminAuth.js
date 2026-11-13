import { timingSafeEqual } from 'node:crypto';

export function adminKeyFromEnv(env = process.env) {
  return (env.ADMIN_KEY || env.APP_SECRET || '').trim();
}

export function adminAuthorized(req, env = process.env) {
  const expected = adminKeyFromEnv(env);
  if (!expected) return false;
  const got = String(req.headers['x-admin-key'] || '').trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

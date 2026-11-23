function num(env, key) {
  const raw = env[key];
  if (raw === undefined || raw === null) throw new Error(`missing ${key}`);
  const trimmed = String(raw).trim();
  if (trimmed === '') throw new Error(`missing ${key}`);
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid ${key}`);
  if (key === 'PROTECTION_RATE' && !(n > 0)) throw new Error(`invalid ${key}`);
  return n;
}

function str(env, key) {
  const raw = (env[key] || '').trim();
  if (!raw) throw new Error(`missing ${key}`);
  return raw.replace(/\/$/, '');
}

export function loadConfig(env = process.env) {
  const rate = num(env, 'PROTECTION_RATE');
  const maxCovered = num(env, 'PROTECTION_MAX_COVERED');
  return {
    shopDomain: str(env, 'SHOP_DOMAIN'),
    token: str(env, 'TOKEN'),
    apiVersion: env.WEBHOOK_API_VERSION || '2026-07',
    publicBaseUrl: str(env, 'PUBLIC_BASE_URL'),
    protectionHandle: str(env, 'PROTECTION_HANDLE'),
    rate,
    maxCovered,
    feeCap: rate * maxCovered,
  };
}

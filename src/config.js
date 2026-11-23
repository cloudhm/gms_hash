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

function optionalNum(env, key) {
  const raw = env[key];
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid ${key}`);
  if (key === 'PROTECTION_RATE' && !(n > 0)) throw new Error(`invalid ${key}`);
  return n;
}

function optionalStr(env, key) {
  const raw = (env[key] || '').trim();
  return raw ? raw.replace(/\/$/, '') : '';
}

export function loadConfig(env = process.env) {
  const apiDomain = optionalStr(env, 'API_DOMAIN');
  const rate = optionalNum(env, 'PROTECTION_RATE');
  const maxCovered = optionalNum(env, 'PROTECTION_MAX_COVERED');
  if (!apiDomain && (rate === null || maxCovered === null)) {
    throw new Error('missing API_DOMAIN or both PROTECTION_RATE and PROTECTION_MAX_COVERED');
  }
  const resolvedRate = rate ?? 0;
  const resolvedMax = maxCovered ?? 0;
  return {
    shopDomain: str(env, 'SHOP_DOMAIN'),
    token: str(env, 'TOKEN'),
    apiVersion: env.WEBHOOK_API_VERSION || '2026-07',
    publicBaseUrl: str(env, 'PUBLIC_BASE_URL'),
    protectionHandle: str(env, 'PROTECTION_HANDLE'),
    apiDomain,
    rate: resolvedRate,
    maxCovered: resolvedMax,
    feeCap: resolvedRate * resolvedMax,
  };
}

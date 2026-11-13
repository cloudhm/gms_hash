export function adminKeyFromEnv(env = {}) {
  return String(env.ADMIN_KEY || env.APP_SECRET || '').trim();
}

function headerValue(request, name) {
  const headers = request.headers;
  if (headers && typeof headers.get === 'function') {
    return String(headers.get(name) || '').trim();
  }
  const key = name.toLowerCase();
  return String((headers && (headers[key] || headers[name])) || '').trim();
}

export function adminAuthorized(request, env = {}) {
  const expected = adminKeyFromEnv(env);
  const got = headerValue(request, 'X-Admin-Key');
  if (!expected || !got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i += 1) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

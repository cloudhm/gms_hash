import { onRequestGet as healthGet } from '../functions/health.js';
import { onRequestGet as configGet } from '../functions/widget/config.js';
import {
  onRequestGet as tagsGet,
  onRequestPost as tagsPost,
} from '../functions/admin/api/script-tags.js';
import {
  onRequestPut as tagsPut,
  onRequestDelete as tagsDelete,
} from '../functions/admin/api/script-tags/[id].js';

function readRaw(req) {
  if (req.body != null && typeof req.body !== 'string' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(JSON.stringify(req.body));
  }
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function matchHandler(method, pathname) {
  if (pathname === '/health' && method === 'GET') return { fn: healthGet };
  if (pathname === '/widget/config' && method === 'GET') return { fn: configGet };
  if (pathname === '/admin/api/script-tags' && method === 'GET') return { fn: tagsGet };
  if (pathname === '/admin/api/script-tags' && method === 'POST') return { fn: tagsPost };
  const tagsId = pathname.match(/^\/admin\/api\/script-tags\/([^/]+)$/);
  if (tagsId && method === 'PUT') return { fn: tagsPut, params: { id: decodeURIComponent(tagsId[1]) } };
  if (tagsId && method === 'DELETE') {
    return { fn: tagsDelete, params: { id: decodeURIComponent(tagsId[1]) } };
  }
  return null;
}

export async function handleNode(req, res, next, env) {
  const host = req.headers.host || '127.0.0.1';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const url = new URL(req.url, `${proto}://${host}`);
  const hit = matchHandler(req.method, url.pathname);
  if (!hit) {
    next();
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await readRaw(req);
    init.duplex = 'half';
  }

  const context = {
    request: new Request(url, init),
    env,
    params: hit.params || {},
  };
  const response = await hit.fn(context);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createCatalog } from './catalog.js';
import { adminAuthorized } from './adminAuth.js';
import {
  listScriptTags,
  createScriptTag,
  updateScriptTag,
  deleteScriptTag,
} from './scriptTagsApi.js';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from './webhooksApi.js';

const config = loadConfig();
const catalog = createCatalog(config);
const widgetPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'widget.js');
const adminPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'admin.html');

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url.pathname === '/' || url.pathname === '') {
    let cfgStatus = 'config not loaded';
    let extra = '';
    try {
      const pub = await catalog.getPublicConfig();
      cfgStatus = 'ok';
      extra = `<tr><th>productId</th><td>${pub.productId}</td></tr>
<tr><th>handle</th><td>${pub.handle || ''}</td></tr>
<tr><th>rate</th><td>${pub.rate}</td></tr>
<tr><th>maxCovered</th><td>${pub.maxCovered}</td></tr>
<tr><th>feeCap</th><td>${pub.feeCap}</td></tr>
<tr><th>variants</th><td>${(pub.variants || []).length}</td></tr>`;
    } catch (err) {
      cfgStatus = String(err.message);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><title>SSS app status</title>
<style>body{font-family:sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{width:140px;background:#f5f5f5}</style>
<h1>Shipping Secure Service</h1>
<p>这是私有 App 进程状态，不是店匠后台。</p>
<table>
<tr><th>server</th><td>running</td></tr>
<tr><th>shop</th><td>${config.shopDomain}</td></tr>
<tr><th>catalog</th><td>${cfgStatus}</td></tr>
${extra}
</table>
<p>
<a href="/health">/health</a> ·
<a href="/widget.js">/widget.js</a> ·
<a href="/widget/config">/widget/config</a> ·
<a href="/admin">/admin Script Tag · Webhook</a>
</p>`);
    return;
  }
  if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/widget/config') {
    try {
      const data = await catalog.getPublicConfig();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(err.message) }));
    }
    return;
  }
  if (url.pathname === '/widget.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.end(fs.readFileSync(widgetPath));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/webhooks') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    console.log('webhook', req.headers['x-shoplazza-topic'] || req.headers['x-shoplazza-event'] || '', raw.slice(0, 2000));
    json(res, 200, { ok: true });
    return;
  }
  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(adminPath));
    return;
  }
  if (url.pathname.startsWith('/admin/api/')) {
    if (!adminAuthorized(req)) {
      json(res, 401, { error: 'unauthorized' });
      return;
    }
    try {
      if (req.method === 'GET' && url.pathname === '/admin/api/script-tags') {
        const tags = await listScriptTags(config);
        json(res, 200, {
          tags,
          defaultSrc: `${config.publicBaseUrl}/widget.js`,
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/admin/api/script-tags') {
        const body = await readBody(req);
        const tag = await createScriptTag(config, body);
        json(res, 200, { tag });
        return;
      }
      const m = url.pathname.match(/^\/admin\/api\/script-tags\/([^/]+)$/);
      if (m && req.method === 'PUT') {
        const body = await readBody(req);
        const tag = await updateScriptTag(config, decodeURIComponent(m[1]), body);
        json(res, 200, { tag });
        return;
      }
      if (m && req.method === 'DELETE') {
        await deleteScriptTag(config, decodeURIComponent(m[1]));
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/admin/api/webhooks') {
        const webhooks = await listWebhooks(config);
        json(res, 200, {
          webhooks,
          defaultAddress: `${config.publicBaseUrl}/webhooks`,
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/admin/api/webhooks') {
        const body = await readBody(req);
        const webhook = await createWebhook(config, body);
        json(res, 200, { webhook });
        return;
      }
      const w = url.pathname.match(/^\/admin\/api\/webhooks\/([^/]+)$/);
      if (w && req.method === 'PUT') {
        const body = await readBody(req);
        const webhook = await updateWebhook(config, decodeURIComponent(w[1]), body);
        json(res, 200, { webhook });
        return;
      }
      if (w && req.method === 'DELETE') {
        await deleteWebhook(config, decodeURIComponent(w[1]));
        json(res, 200, { ok: true });
        return;
      }
    } catch (err) {
      json(res, 500, { error: String(err.message || err) });
      return;
    }
    json(res, 404, { error: 'not found' });
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => console.log(`listening ${port}`));

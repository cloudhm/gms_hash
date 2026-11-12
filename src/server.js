import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createCatalog } from './catalog.js';

const config = loadConfig();
const catalog = createCatalog(config);
const widgetPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'widget.js');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  res.statusCode = 404;
  res.end('not found');
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => console.log(`listening ${port}`));

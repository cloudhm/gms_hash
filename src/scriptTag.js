import { loadConfig } from './config.js';

function isPublicHttpsOrigin(baseUrl) {
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const config = loadConfig();
const src = `${config.publicBaseUrl}/widget.js`;
const api = `https://${config.shopDomain}/openapi/${config.apiVersion}/script_tags`;
const headers = { 'Access-Token': config.token, 'Content-Type': 'application/json' };

const listed = await fetch(api, { headers }).then((r) => r.json());
const tags = listed.data?.script_tags || listed.data || [];
const hit = (Array.isArray(tags) ? tags : []).find((t) => t.src === src);
if (hit) {
  console.log('script tag exists', hit.id);
  process.exit(0);
}

if (!isPublicHttpsOrigin(config.publicBaseUrl)) {
  console.error(
    'skip POST: PUBLIC_BASE_URL must be a public HTTPS origin (not localhost).',
  );
  console.error(
    'After tunnel: set PUBLIC_BASE_URL in .env, then run: node --env-file=.env src/scriptTag.js',
  );
  process.exit(2);
}

const created = await fetch(api, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    script_tag: { src, display_scope: 'cart', event_type: 'app' },
  }),
}).then((r) => r.json());
console.log(JSON.stringify(created, null, 2));
if (!created.data?.script_tag?.id && created.code && created.code !== 'Success') {
  process.exit(1);
}

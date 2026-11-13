export function shopHeaders(config) {
  return { 'Access-Token': config.token, 'Content-Type': 'application/json' };
}

export function webhooksUrl(config, id) {
  const base = `https://${config.shopDomain}/openapi/${config.apiVersion}/webhooks`;
  return id ? `${base}/${id}` : base;
}

export async function listWebhooks(config) {
  const res = await fetch(webhooksUrl(config), { headers: shopHeaders(config) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `list HTTP ${res.status}`);
  const hooks = body.data?.webhooks || body.data || [];
  return Array.isArray(hooks) ? hooks : [];
}

export async function createWebhook(config, { address, topic }) {
  const res = await fetch(webhooksUrl(config), {
    method: 'POST',
    headers: shopHeaders(config),
    body: JSON.stringify({ webhook: { address, topic } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `create HTTP ${res.status}`);
  return body.data?.webhook || body.data;
}

export async function updateWebhook(config, id, { address, topic }) {
  const res = await fetch(webhooksUrl(config, id), {
    method: 'PUT',
    headers: shopHeaders(config),
    body: JSON.stringify({ id, webhook: { address, topic } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `update HTTP ${res.status}`);
  return body.data?.webhook || body.data;
}

export async function deleteWebhook(config, id) {
  const res = await fetch(webhooksUrl(config, id), {
    method: 'DELETE',
    headers: shopHeaders(config),
  });
  if (res.status === 204 || res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message || `delete HTTP ${res.status}`);
}

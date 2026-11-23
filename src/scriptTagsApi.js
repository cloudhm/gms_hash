export function shopHeaders(config) {
  return { 'Access-Token': config.token, 'Content-Type': 'application/json' };
}

export function scriptTagsUrl(config, id) {
  const base = `https://${config.shopDomain}/openapi/${config.apiVersion}/script_tags`;
  return id ? `${base}/${id}` : base;
}

export async function listScriptTags(config) {
  const res = await fetch(scriptTagsUrl(config), { headers: shopHeaders(config) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `list HTTP ${res.status}`);
  const tags = body.data?.script_tags || body.data || [];
  return Array.isArray(tags) ? tags : [];
}

export async function createScriptTag(config, { src, display_scope, event_type }) {
  const res = await fetch(scriptTagsUrl(config), {
    method: 'POST',
    headers: shopHeaders(config),
    body: JSON.stringify({
      script_tag: {
        src,
        display_scope: display_scope || 'index,collection,product,search,cart',
        event_type: event_type || 'app',
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `create HTTP ${res.status}`);
  return body.data?.script_tag || body.data;
}

export async function updateScriptTag(config, id, { src, display_scope, event_type }) {
  const res = await fetch(scriptTagsUrl(config, id), {
    method: 'PUT',
    headers: shopHeaders(config),
    body: JSON.stringify({
      script_tag: {
        src,
        display_scope,
        event_type: event_type || 'app',
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `update HTTP ${res.status}`);
  return body.data?.script_tag || body.data;
}

export async function deleteScriptTag(config, id) {
  const res = await fetch(scriptTagsUrl(config, id), {
    method: 'DELETE',
    headers: shopHeaders(config),
  });
  if (res.status === 204 || res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message || `delete HTTP ${res.status}`);
}

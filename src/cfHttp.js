import { loadConfig } from './config.js';
import { adminAuthorized } from './adminAuth.js';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders() });
}

export function loadAppConfig(context) {
  const env = context.env || {};
  const origin = new URL(context.request.url).origin;
  return loadConfig({
    SHOP_DOMAIN: env.SHOP_DOMAIN,
    TOKEN: env.TOKEN,
    WEBHOOK_API_VERSION: env.WEBHOOK_API_VERSION || '2026-07',
    PUBLIC_BASE_URL: env.PUBLIC_BASE_URL || origin,
    PROTECTION_PRODUCT_ID: env.PROTECTION_PRODUCT_ID,
    PROTECTION_HANDLE: env.PROTECTION_HANDLE,
    PROTECTION_RATE: env.PROTECTION_RATE,
    PROTECTION_MAX_COVERED: env.PROTECTION_MAX_COVERED,
  });
}

export function requireAdmin(context) {
  if (!adminAuthorized(context.request, context.env || {})) {
    return json({ error: 'unauthorized' }, 401);
  }
  return null;
}

export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

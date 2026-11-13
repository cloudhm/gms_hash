import { loadConfig } from './config.js';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    PROTECTION_HANDLE: env.PROTECTION_HANDLE,
    PROTECTION_RATE: env.PROTECTION_RATE,
    PROTECTION_MAX_COVERED: env.PROTECTION_MAX_COVERED,
  });
}

export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

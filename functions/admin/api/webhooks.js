import { listWebhooks, createWebhook } from '../../../src/webhooksApi.js';
import { json, loadAppConfig, readJson, requireAdmin } from '../../../src/cfHttp.js';

export async function onRequestGet(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  const webhooks = await listWebhooks(config);
  return json({
    webhooks,
    defaultAddress: `${config.publicBaseUrl}/webhooks`,
  });
}

export async function onRequestPost(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  const body = await readJson(context.request);
  const webhook = await createWebhook(config, body);
  return json({ webhook });
}

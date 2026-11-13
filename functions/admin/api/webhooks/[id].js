import { updateWebhook, deleteWebhook } from '../../../../src/webhooksApi.js';
import { json, loadAppConfig, readJson, requireAdmin } from '../../../../src/cfHttp.js';

export async function onRequestPut(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  const body = await readJson(context.request);
  const webhook = await updateWebhook(config, context.params.id, body);
  return json({ webhook });
}

export async function onRequestDelete(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  await deleteWebhook(config, context.params.id);
  return json({ ok: true });
}

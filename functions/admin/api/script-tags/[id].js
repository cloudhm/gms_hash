import {
  updateScriptTag,
  deleteScriptTag,
} from '../../../../src/scriptTagsApi.js';
import { json, loadAppConfig, readJson, requireAdmin } from '../../../../src/cfHttp.js';

export async function onRequestPut(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  const body = await readJson(context.request);
  const tag = await updateScriptTag(config, context.params.id, body);
  return json({ tag });
}

export async function onRequestDelete(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  await deleteScriptTag(config, context.params.id);
  return json({ ok: true });
}

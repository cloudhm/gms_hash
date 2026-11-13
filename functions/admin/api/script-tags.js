import {
  listScriptTags,
  createScriptTag,
} from '../../../src/scriptTagsApi.js';
import { json, loadAppConfig, readJson, requireAdmin } from '../../../src/cfHttp.js';

export async function onRequestGet(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  const tags = await listScriptTags(config);
  return json({
    tags,
    defaultSrc: `${config.publicBaseUrl}/widget.js`,
  });
}

export async function onRequestPost(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const config = loadAppConfig(context);
  const body = await readJson(context.request);
  const tag = await createScriptTag(config, body);
  return json({ tag });
}

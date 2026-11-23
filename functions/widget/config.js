import { createCatalog } from '../../src/catalog.js';
import { json, loadAppConfig } from '../../src/cfHttp.js';

export async function onRequestGet(context) {
  try {
    const config = loadAppConfig(context);
    const data = await createCatalog(config).getPublicConfig();
    return json(data);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}

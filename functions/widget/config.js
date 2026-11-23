import { createCatalog } from '../../src/catalog.js';
import { json, loadAppConfig } from '../../src/cfHttp.js';

export async function onRequestGet(context) {
  try {
    const config = loadAppConfig(context);
    const data = await createCatalog(config).getPublicConfig();
    const res = json(data);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}

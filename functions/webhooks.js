import { json } from '../src/cfHttp.js';

export async function onRequestPost(context) {
  const raw = await context.request.text();
  const topic =
    context.request.headers.get('x-shoplazza-topic') ||
    context.request.headers.get('x-shoplazza-event') ||
    '';
  console.log('webhook', topic, raw.slice(0, 2000));
  return json({ ok: true });
}

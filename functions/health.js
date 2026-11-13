import { json } from '../src/cfHttp.js';

export function onRequestGet() {
  return json({ ok: true });
}

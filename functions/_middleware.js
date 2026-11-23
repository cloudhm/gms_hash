import { corsHeaders, json } from '../src/cfHttp.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  try {
    return await context.next();
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}

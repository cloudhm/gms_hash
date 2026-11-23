/**
 * Parse GOOVAL app-config.js (same GWOFY_CONFIG envelope as Shopify plugin).
 * Shoplazza app uses only pricing.calcRate and pricing.spMaxCoverage.
 */
/** Brace-balanced extract; safe in Workers (no eval / new Function). */
function parseJsonObjectLiteral(source, startIndex) {
  if (source[startIndex] !== '{') throw new Error('GWOFY_CONFIG payload must be JSON object');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(startIndex, i + 1));
    }
  }
  throw new Error('unterminated GWOFY_CONFIG JSON');
}

export function parseGwofyAppConfigScript(source) {
  const marker = 'GWOFY_CONFIG';
  const markerAt = source.indexOf(marker);
  if (markerAt === -1) throw new Error('GWOFY_CONFIG missing in app-config.js');
  const eq = source.indexOf('=', markerAt + marker.length);
  if (eq === -1) throw new Error('GWOFY_CONFIG missing in app-config.js');
  let i = eq + 1;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  const cfg = parseJsonObjectLiteral(source, i);
  if (!cfg || typeof cfg !== 'object') throw new Error('GWOFY_CONFIG missing in app-config.js');
  return cfg;
}

/** spMaxCoverage from GOOVAL is in cents (e.g. 250500 → 2505 USD cap). */
export function spMaxCoverageToDollars(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error('invalid spMaxCoverage');
  return Math.round(n) / 100;
}

export function pricingFromGwofyConfig(gwofyConfig) {
  const pricing = gwofyConfig?.pricing;
  if (!pricing) throw new Error('GWOFY_CONFIG.pricing missing');
  const rate = Number(pricing.calcRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('invalid GWOFY_CONFIG.pricing.calcRate');
  const maxCovered = spMaxCoverageToDollars(pricing.spMaxCoverage);
  return { rate, maxCovered };
}

export async function fetchGwofyPricing({ apiDomain, shopDomain }) {
  if (!apiDomain) throw new Error('missing API_DOMAIN');
  if (!shopDomain) throw new Error('missing SHOP_DOMAIN');
  const base = `${apiDomain.replace(/\/$/, '')}/static/app-config.js?shop=${encodeURIComponent(shopDomain)}`;
  const url = `${base}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/javascript,*/*' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`app-config ${res.status}`);
  const gwofy = parseGwofyAppConfigScript(await res.text());
  return pricingFromGwofyConfig(gwofy);
}
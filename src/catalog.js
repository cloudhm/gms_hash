import { fetchGwofyPricing } from './goovalAppConfig.js';

async function resolvePricing(config) {
  if (config.apiDomain) {
    return fetchGwofyPricing({
      apiDomain: config.apiDomain,
      shopDomain: config.shopDomain,
    });
  }
  if (config.rate > 0 && config.maxCovered > 0) {
    return { rate: config.rate, maxCovered: config.maxCovered };
  }
  throw new Error('missing pricing: API_DOMAIN or PROTECTION_RATE/PROTECTION_MAX_COVERED');
}

function openapiHeaders(config) {
  return { 'Access-Token': config.token };
}

function productList(body) {
  const data = body.data?.products || body.data?.product || body.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && data.id) return [data];
  return [];
}

export async function resolveProductId(config) {
  const handle = config.protectionHandle;
  const url = `https://${config.shopDomain}/openapi/${config.apiVersion}/products?handles=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { headers: openapiHeaders(config) });
  if (!res.ok) throw new Error(`product list ${res.status}`);
  const body = await res.json();
  const match = productList(body).find((p) => String(p.handle) === String(handle)) || productList(body)[0];
  const id = match?.id;
  if (!id) throw new Error(`protection product not found for handle ${handle}`);
  return id;
}

export async function fetchVariants(config) {
  const productId = await resolveProductId(config);
  const url = `https://${config.shopDomain}/openapi/${config.apiVersion}/products/${productId}`;
  const res = await fetch(url, { headers: openapiHeaders(config) });
  if (!res.ok) throw new Error(`product fetch ${res.status}`);
  const body = await res.json();
  const product = body.data?.product || body.data;
  const variants = (product.variants || []).map((v) => ({
    id: v.id,
    sku: v.sku,
    price: Number(v.price),
  }));
  if (!variants.length) throw new Error('no protection variants');
  return { productId, variants };
}

export function createCatalog(config, loader = fetchVariants) {
  let variantCache = null;
  return {
    async getPublicConfig() {
      const [variantData, pricing] = await Promise.all([
        variantCache
          ? Promise.resolve(variantCache)
          : loader(config).then((data) => {
              variantCache = data;
              return data;
            }),
        resolvePricing(config),
      ]);
      const { productId, variants } = variantData;
      const { rate, maxCovered } = pricing;
      return {
        productId,
        handle: config.protectionHandle,
        rate,
        maxCovered,
        feeCap: Math.round(rate * maxCovered * 100) / 100,
        variants,
      };
    },
  };
}

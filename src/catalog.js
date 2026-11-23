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
  let cache = null;
  return {
    async getPublicConfig() {
      if (!cache) cache = await loader(config);
      const productId = cache.productId;
      const variants = cache.variants || cache;
      return {
        productId,
        handle: config.protectionHandle,
        rate: config.rate,
        maxCovered: config.maxCovered,
        feeCap: config.feeCap,
        variants,
      };
    },
  };
}

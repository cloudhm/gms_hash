export async function fetchVariants(config) {
  const url = `https://${config.shopDomain}/openapi/${config.apiVersion}/products/${config.protectionProductId}`;
  const res = await fetch(url, { headers: { 'Access-Token': config.token } });
  if (!res.ok) throw new Error(`product fetch ${res.status}`);
  const body = await res.json();
  const product = body.data?.product || body.data;
  const variants = (product.variants || []).map((v) => ({
    id: v.id,
    sku: v.sku,
    price: Number(v.price),
  }));
  if (!variants.length) throw new Error('no protection variants');
  return variants;
}

export function createCatalog(config, loader = fetchVariants) {
  let cache = null;
  return {
    async getPublicConfig() {
      if (!cache) cache = await loader(config);
      return {
        productId: config.protectionProductId,
        rate: config.rate,
        maxCovered: config.maxCovered,
        feeCap: config.feeCap,
        variants: cache,
      };
    },
  };
}

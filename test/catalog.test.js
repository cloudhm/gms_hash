import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, fetchVariants } from '../src/catalog.js';

const config = {
  shopDomain: 'gmshash.myshoplaza.com',
  token: 'tok',
  apiVersion: '2026-07',
  protectionHandle: 'gwofy-shipping-protection-qaqwer',
  rate: 0.02,
  maxCovered: 2505,
  feeCap: 50.1,
};

test('resolves product id from handle then loads variants', async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('handles=')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            products: [{ id: 'prod-uuid', handle: 'gwofy-shipping-protection-qaqwer' }],
          },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: {
          product: {
            id: 'prod-uuid',
            variants: [{ id: 'v1', sku: 'S0001', price: '1.00' }],
          },
        },
      }),
    };
  };
  try {
    const data = await createCatalog(config).getPublicConfig();
    assert.equal(data.productId, 'prod-uuid');
    assert.equal(data.handle, 'gwofy-shipping-protection-qaqwer');
    assert.equal(data.variants[0].id, 'v1');
    assert.ok(calls[0].includes('handles=gwofy-shipping-protection-qaqwer'));
    assert.ok(calls[1].includes('/products/prod-uuid'));
  } finally {
    globalThis.fetch = orig;
  }
});

test('fetchVariants throws when handle is missing in store', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { products: [] } }),
  });
  try {
    await assert.rejects(() => fetchVariants(config), /not found/);
  } finally {
    globalThis.fetch = orig;
  }
});

// test/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const base = {
  SHOP_DOMAIN: 'gooval.myshoplaza.com',
  TOKEN: 'tok',
  WEBHOOK_API_VERSION: '2026-07',
  PUBLIC_BASE_URL: 'https://example.com',
  PROTECTION_PRODUCT_ID: '7c811a80-72f8-4972-9305-f32ecf8d35db',
  PROTECTION_HANDLE: 'gwofy-shipping-protection-qaqwer',
  PROTECTION_RATE: '0.02',
  PROTECTION_MAX_COVERED: '2505',
};

test('parses rate, max covered, and fee cap', () => {
  const c = loadConfig(base);
  assert.equal(c.rate, 0.02);
  assert.equal(c.maxCovered, 2505);
  assert.equal(c.feeCap, 50.1);
});

test('throws when PROTECTION_RATE missing', () => {
  const env = { ...base };
  delete env.PROTECTION_RATE;
  assert.throws(() => loadConfig(env), /PROTECTION_RATE/);
});

test('throws when PROTECTION_RATE is not a number', () => {
  assert.throws(() => loadConfig({ ...base, PROTECTION_RATE: 'abc' }), /PROTECTION_RATE/);
});

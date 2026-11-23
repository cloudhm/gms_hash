import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGwofyAppConfigScript,
  pricingFromGwofyConfig,
  spMaxCoverageToDollars,
} from '../src/goovalAppConfig.js';

const sampleScript = `(function (g) {
  g.GWOFY_CONFIG = {"pricing": {"calcRate": "0.02", "spMaxCoverage": 250500}};
})(typeof window !== "undefined" ? window : globalThis);`;

test('parseGwofyAppConfigScript extracts GWOFY_CONFIG', () => {
  const cfg = parseGwofyAppConfigScript(sampleScript);
  assert.equal(cfg.pricing.calcRate, '0.02');
  assert.equal(cfg.pricing.spMaxCoverage, 250500);
});

test('pricingFromGwofyConfig maps calcRate and spMaxCoverage', () => {
  const cfg = parseGwofyAppConfigScript(sampleScript);
  const p = pricingFromGwofyConfig(cfg);
  assert.equal(p.rate, 0.02);
  assert.equal(p.maxCovered, 2505);
});

test('spMaxCoverageToDollars', () => {
  assert.equal(spMaxCoverageToDollars(250500), 2505);
});
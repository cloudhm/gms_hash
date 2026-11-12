import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleSubtotal, pickVariant } from '../src/pricing.js';

const PID = '7c811a80-72f8-4972-9305-f32ecf8d35db';
const tiers = [
  { id: 'v1', price: 0.98 },
  { id: 'v2', price: 1.15 },
  { id: 'v5', price: 2.05 },
  { id: 'v65', price: 49.48 },
  { id: 'v66', price: 55.03 },
];
const opts = { rate: 0.02, maxCovered: 2505, variants: tiers };

test('excludes protection lines from subtotal', () => {
  const n = eligibleSubtotal(
    [
      { product_id: 'other', final_line_price: '50.00' },
      { product_id: PID, final_line_price: '1.15' },
    ],
    PID,
  );
  assert.equal(n, 50);
});

test('empty or protection-only cart is 0', () => {
  assert.equal(eligibleSubtotal([], PID), 0);
  assert.equal(eligibleSubtotal([{ product_id: PID, line_price: '1.15' }], PID), 0);
});

test('$50 maps to $1.15 tier', () => {
  const r = pickVariant({ subtotal: 50, ...opts });
  assert.equal(r.variant.id, 'v2');
  assert.equal(r.raw, 1);
});

test('exact tier price does not round up', () => {
  const r = pickVariant({ subtotal: 2.05 / 0.02, ...opts });
  assert.equal(r.variant.price, 2.05);
});

test('cap uses S0065 not S0066', () => {
  const r = pickVariant({ subtotal: 9999, ...opts });
  assert.equal(r.covered, 2505);
  assert.equal(r.cap, 50.1);
  assert.equal(r.variant.price, 49.48);
});

test('returns null when no variants under cap', () => {
  const r = pickVariant({
    subtotal: 50,
    rate: 0.02,
    maxCovered: 2505,
    variants: [{ id: 'x', price: 999 }],
  });
  assert.equal(r, null);
});

test('returns null when subtotal is 0', () => {
  assert.equal(pickVariant({ subtotal: 0, ...opts }), null);
});

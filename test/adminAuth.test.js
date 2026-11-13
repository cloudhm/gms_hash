import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuthorized } from '../src/adminAuth.js';

test('authorizes matching X-Admin-Key on Fetch Request', () => {
  const req = new Request('https://example.com/admin/api/script-tags', {
    headers: { 'X-Admin-Key': 'secret-key' },
  });
  assert.equal(adminAuthorized(req, { APP_SECRET: 'secret-key' }), true);
});

test('rejects wrong key', () => {
  const req = new Request('https://example.com', {
    headers: { 'X-Admin-Key': 'nope' },
  });
  assert.equal(adminAuthorized(req, { APP_SECRET: 'secret-key' }), false);
});

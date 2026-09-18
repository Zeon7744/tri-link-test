'use strict';
const assert = require('assert');
const { AfdianFetcher, httpsGet } = require('../src/afdian-fetcher.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${name}: ${err.message}`);
  }
}

console.log('\n=== AfdianFetcher Tests ===\n');

test('AfdianFetcher is importable', () => {
  assert.strictEqual(typeof AfdianFetcher, 'function');
  assert.strictEqual(typeof httpsGet, 'function');
});

test('constructor sets defaults', () => {
  const f = new AfdianFetcher({});
  assert.ok(f.user, 'has user');
  assert.strictEqual(f.intervalMs, 3600000, 'default 1 hour interval');
  assert.strictEqual(f.timer, null, 'timer is null initially');
  assert.strictEqual(f.fetchCount, 0, 'fetchCount starts at 0');
});

test('constructor reads env vars', () => {
  process.env.AFDIAN_USER = 'TestUser';
  const f = new AfdianFetcher({});
  assert.strictEqual(f.user, 'TestUser');
  delete process.env.AFDIAN_USER;
});

test('getStatus returns correct shape', () => {
  const f = new AfdianFetcher({ user: 'test' });
  const status = f.getStatus();
  assert.strictEqual(status.user, 'test');
  assert.strictEqual(status.running, false);
  assert.strictEqual(status.fetchCount, 0);
  assert.strictEqual(status.hasToken, false);
});

test('getLatest returns null before first fetch', () => {
  const f = new AfdianFetcher({ user: 'test' });
  assert.strictEqual(f.getLatest(), null);
});

test('fetchCreatorInfo returns result (network)', async () => {
  const f = new AfdianFetcher({ user: 'Zeon7744' });
  const result = await f.fetchCreatorInfo();
  assert.ok(result.type === 'creator_info', 'type is creator_info');
  assert.strictEqual(result.user, 'Zeon7744');
  assert.ok(result.page_url.includes('afdian.com'), 'has page_url');
});

test('fetchSponsorStats without token returns error', async () => {
  const f = new AfdianFetcher({ user: 'test', token: '' });
  const result = await f.fetchSponsorStats();
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.includes('token'), 'error mentions token');
});

test('httpsGet returns structured response', async () => {
  const res = await httpsGet('https://afdian.com/a/Zeon7744');
  assert.ok(res.status >= 200, 'got HTTP response');
});

test('start/stop lifecycle', () => {
  const f = new AfdianFetcher({ user: 'test', intervalMs: 999999999 });
  f.start(999999999);
  assert.ok(f.timer, 'timer set after start');
  f.stop();
  assert.strictEqual(f.timer, null, 'timer cleared after stop');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

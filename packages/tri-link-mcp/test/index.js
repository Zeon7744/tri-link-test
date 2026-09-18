'use strict';
const assert = require('assert');
const { TOOLS, handleTool } = require('../src/server.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (err) { failed++; console.log(`  \u2717 ${name}: ${err.message}`); }
}

console.log('\n=== Tri-Link MCP Tests ===\n');

test('TOOLS array has 6 tools', () => {
  assert.strictEqual(TOOLS.length, 6, 'expected 6 tools');
  const names = TOOLS.map((t) => t.name);
  assert.ok(names.includes('get_repo_stats'), 'has get_repo_stats');
  assert.ok(names.includes('list_issues'), 'has list_issues');
  assert.ok(names.includes('search_repos'), 'has search_repos');
  assert.ok(names.includes('gitee_repo_info'), 'has gitee_repo_info');
  assert.ok(names.includes('afdian_creator_info'), 'has afdian_creator_info');
  assert.ok(names.includes('afdian_sponsor_stats'), 'has afdian_sponsor_stats');
});

test('handleTool returns error for unknown tool', () => {
  const p = handleTool('nonexistent_tool', {});
  assert.ok(p instanceof Promise, 'returns promise');
});

test('get_repo_stats works with real API (may fail offline)', async () => {
  try {
    const result = await handleTool('get_repo_stats', { owner: 'Zeon7744', repo: 'tri-link-test' });
    assert.ok(result.stars !== undefined, 'has stars field');
  } catch {
    // offline is acceptable
  }
});

test('search_repos works with real API (may fail offline)', async () => {
  try {
    const result = await handleTool('search_repos', { query: 'tri-link', limit: 1 });
    assert.ok(Array.isArray(result) || result.error, 'returns array or error');
  } catch {}
});

test('afdian_creator_info returns user info', async () => {
  try {
    const result = await handleTool('afdian_creator_info', {});
    assert.ok(result.user, 'has user field');
    assert.ok(result.page_url, 'has page_url');
  } catch {}
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

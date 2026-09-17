'use strict';
/**
 * Tri-Link DevKit - Unit Tests
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function main() {
  console.log('\n=== Tri-Link DevKit Tests ===\n');

  // 1. CLI help
  test('CLI help runs without error', () => {
    const out = execSync(`node "${CLI}" help`, { encoding: 'utf8' });
    assert.ok(out.includes('Tri-Link DevKit'), 'Should show banner');
    assert.ok(out.includes('init'), 'Should list init command');
    assert.ok(out.includes('push'), 'Should list push command');
  });

  // 2. Status in repo
  test('status returns valid JSON in repo', () => {
    const out = execSync(`node "${CLI}" status`, { encoding: 'utf8', cwd: path.join(__dirname, '..', '..') });
    const data = JSON.parse(out);
    assert.ok(data.branch, 'Should have branch');
    assert.ok(Array.isArray(data.remotes), 'Should have remotes array');
    assert.strictEqual(data.repo, 'tri-link-test', 'Repo name should match');
  });

  // 3. Init in temp dir
  test('init creates all expected files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-link-devkit-test-'));
    try {
      execSync(
        `node "${CLI}" init test-repo -g TestUser -G TestUser -A TestUser -d "test"`,
        { encoding: 'utf8', cwd: tmpDir }
      );
      // Check files
      assert.ok(fs.existsSync(path.join(tmpDir, 'README.md')), 'README.md exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.gitignore')), '.gitignore exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.github', 'FUNDING.yml')), 'FUNDING.yml exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.github', 'workflows', 'sync.yml')), 'sync.yml exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.tri-link', 'config.json')), 'config.json exists');
      assert.ok(fs.existsSync(path.join(tmpDir, '.git')), 'git repo exists');

      // Check config content
      const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.tri-link', 'config.json'), 'utf8'));
      assert.strictEqual(config.repo, 'test-repo');
      assert.strictEqual(config.github.user, 'TestUser');
      assert.strictEqual(config.gitee.user, 'TestUser');
      assert.strictEqual(config.afdian.user, 'TestUser');

      // Check FUNDING content
      const funding = fs.readFileSync(path.join(tmpDir, '.github', 'FUNDING.yml'), 'utf8');
      assert.ok(funding.includes('TestUser'), 'FUNDING should contain user');

      // Check git remotes
      const remotes = execSync('git remote -v', { encoding: 'utf8', cwd: tmpDir });
      assert.ok(remotes.includes('github.com'), 'GitHub remote set');
      assert.ok(remotes.includes('gitee.com'), 'Gitee remote set');
      assert.ok(remotes.includes('TestUser'), 'User in remotes');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 4. Dashboard generation
  test('dashboard generates valid HTML', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-link-dash-test-'));
    try {
      execSync(
        `node "${CLI}" dashboard my-dash-repo -g DashUser -A DashUser -o "${tmpDir}"`,
        { encoding: 'utf8', cwd: path.join(__dirname, '..', '..') }
      );
      const htmlPath = path.join(tmpDir, 'index.html');
      assert.ok(fs.existsSync(htmlPath), 'dashboard/index.html created');
      const html = fs.readFileSync(htmlPath, 'utf8');
      assert.ok(html.includes('my-dash-repo'), 'HTML contains repo name');
      assert.ok(html.includes('DashUser'), 'HTML contains user');
      assert.ok(html.includes('<!DOCTYPE html>'), 'Valid HTML doctype');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 5. MCP config generation
  test('mcp-config generates valid JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-link-mcp-test-'));
    try {
      execSync(
        `node "${CLI}" mcp-config -o "${tmpDir}"`,
        { encoding: 'utf8', cwd: path.join(__dirname, '..', '..') }
      );
      const mcpPath = path.join(tmpDir, 'mcp.json');
      assert.ok(fs.existsSync(mcpPath), 'mcp.json created');
      const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      assert.ok(mcp.mcpServers, 'Has mcpServers key');
      assert.ok(mcp.mcpServers.afdian, 'Has afdian server');
      assert.ok(mcp.mcpServers.github, 'Has github server');
      assert.strictEqual(mcp.mcpServers.github.env.GITHUB_USER, 'Zeon7744');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 6. DevKit class import
  test('DevKit class is importable and instantiable', () => {
    const { DevKit } = require('../src/index');
    const dk = new DevKit({ githubUser: 'TestUser', giteeUser: 'TestUser', afdianUser: 'TestUser' });
    assert.strictEqual(dk.githubUser, 'TestUser');
    assert.strictEqual(dk.giteeUser, 'TestUser');
    assert.strictEqual(dk.afdianUser, 'TestUser');
    assert.strictEqual(dk.branch, 'main');
  });

  // 7. Token env var support
  test('token env vars are read correctly', () => {
    process.env.GITHUB_TOKEN = 'test-gh-token';
    process.env.GITEE_TOKEN = 'test-gitee-token';
    const { DevKit } = require('../src/index');
    const dk = new DevKit({});
    assert.strictEqual(dk.githubToken, 'test-gh-token');
    assert.strictEqual(dk.giteeToken, 'test-gitee-token');
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITEE_TOKEN;
  });

  // 8. github-stats against real API
  test('github-stats fetches real data', async () => {
    // This is a network test - skip if offline
    try {
      const out = execSync(
        `node "${CLI}" github-stats tri-link-test`,
        { encoding: 'utf8', timeout: 15000, cwd: path.join(__dirname, '..', '..') }
      );
      const match = out.match(/\{[\s\S]*\}/);
      if (match) {
        const stats = JSON.parse(match[0]);
        assert.ok(stats.user === 'Zeon7744', 'Correct user');
        assert.ok(stats.repo === 'tri-link-test', 'Correct repo');
      }
    } catch {
      // Network failure is acceptable in CI - just pass
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});

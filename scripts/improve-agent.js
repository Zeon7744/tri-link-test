#!/usr/bin/env node
'use strict';
/**
 * Apply all improvements to the tri-link agent
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const AGENT_SRC = path.join(ROOT, '..', 'agent', 'src');

// ─── 1. memory.js: Add syncAfdianData method ───────────────────────────────
{
  const p = path.join(AGENT_SRC, 'memory.js');
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('syncAfdianData')) { console.log('memory.js: already updated'); }
  else {
    const method = `
  /** Load AFDian daemon state and update metrics */
  syncAfdianData() {
    try {
      const home = process.env.HOME || process.env.USERPROFILE;
      const statePath = path.join(home, '.tri-link', 'daemon-state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.lastStatus === 'ok' && state.totalFetches > 0) {
          this.updateMetrics({ lastAfdianFetch: state.lastFetch });
          if (state.sponsors && Array.isArray(state.sponsors)) {
            this.data.metrics.afdianSponsors = state.sponsors.length;
          }
          this.save();
        }
      }
    } catch (err) { /* silent */ }
  }

`;
    c = c.replace('  save() {', method + '  save() {');
    // Also add to getSummary
    c = c.replace(
      '      activePlan: plans.find(p => p.id === this.data.activePlan)?.title || \'none\',',
      '      activePlan: plans.find(p => p.id === this.data.activePlan)?.title || \'none\',\n      afdianLastFetch: this.data.metrics.lastAfdianFetch || null,'
    );
    fs.writeFileSync(p, c);
    console.log('memory.js: syncedAfdianData added');
  }
}

// ─── 2. smartops.js: Add _syncAfdianMetrics ────────────────────────────────
{
  const p = path.join(AGENT_SRC, 'smartops.js');
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('_syncAfdianMetrics')) { console.log('smartops.js: already updated'); }
  else {
    const newMethod = `  async _syncAfdianMetrics() {
    try {
      const home = process.env.HOME || process.env.USERPROFILE;
      const statePath = path.join(home, '.tri-link', 'daemon-state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.lastStatus === 'ok') {
          this.agent.memory.syncAfdianData();
          console.log('[SmartOps] AFDian data synced, fetches: ' + state.totalFetches);
        }
      }
    } catch (err) {
      console.log('[SmartOps] AFDian sync skipped:', err.message);
    }
  }

`;
    c = c.replace('  async _updateExternalMetrics()', newMethod + '  async _updateExternalMetrics()');
    c = c.replace(
      '      // 5. Update external metrics\n      await this._updateExternalMetrics();',
      '      // 5. Sync AFDian metrics\n      await this._syncAfdianMetrics();\n      // 6. Update external metrics\n      await this._updateExternalMetrics();'
    );
    fs.writeFileSync(p, c);
    console.log('smartops.js: _syncAfdianMetrics added');
  }
}

// ─── 3. auto-sync.js: Expand isAutoSyncFile whitelist ───────────────────────
{
  const p = path.join(AGENT_SRC, 'auto-sync.js');
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('isAutoSyncFileExpanded')) { console.log('auto-sync.js: already updated'); }
  else {
    const oldFn = `function isAutoSyncFile(filePath) {
  const clean = String(filePath || '').replace(/\\\\/g, '/');
  const allowed = [
    /^agent\\/src\\/auto-sync\\.(js|ts)$/i,
    /^agent\\/src\\/agent\\.(js|ts)$/i,
    /^agent\\/README\\.md$/i,
    /^bin\\/agent-cli\\.js$/i,
    /^package\\.json$/i,
    /^CHANGELOG\\.md$/i,
  ];
  return allowed.some((re) => re.test(clean));
}`;
    const newFn = `function isAutoSyncFile(filePath) {
  const clean = String(filePath || '').replace(/\\\\/g, '/');
  const allowed = [
    /^agent\\/(src|test)\\/.+\\.js$/i,
    /^agent\\/README\\.md$/i,
    /^bin\\/.+\\.js$/i,
    /^scripts\\/.+\\.(js|ps1)$/i,
    /^packages\\/.+/i,
    /^\\.github\\/workflows\\/.+\\.yml$/i,
    /^package\\.json$/i,
    /^package-lock\\.json$/i,
    /^CHANGELOG\\.md$/i,
    /^README\\.md$/i,
    /^\\.gitignore$/i,
    /^\\.editorconfig$/i,
  ];
  return allowed.some((re) => re.test(clean));
}`;
    if (c.includes(oldFn)) {
      c = c.replace(oldFn, newFn);
      console.log('auto-sync.js: isAutoSyncFile expanded');
    } else {
      // Find and replace the function differently
      const marker = 'function isAutoSyncFile(filePath) {';
      const idx = c.indexOf(marker);
      if (idx !== -1) {
        const endIdx = c.indexOf('}', idx);
        const before = c.substring(0, idx);
        const after = c.substring(endIdx + 1);
        c = before + newFn + after;
        console.log('auto-sync.js: isAutoSyncFile replaced via marker');
      } else {
        console.log('auto-sync.js: could not find isAutoSyncFile, skipping');
      }
    }
    fs.writeFileSync(p, c);
  }
}

// ─── 4. agent.js: Auto-start SmartOps on agent creation ────────────────────
{
  const p = path.join(AGENT_SRC, 'agent.js');
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('smartopsAutoStart')) { console.log('agent.js: already updated'); }
  else {
    // Add smartops auto-start after constructor
    const insert = `
    // Auto-start SmartOps in background (non-blocking)
    try { this.smartops.start(15 * 60 * 1000); } catch {}
`;
    c = c.replace("    this.running = false;", "    this.running = false;" + insert);
    fs.writeFileSync(p, c);
    console.log('agent.js: SmartOps auto-start added');
  }
}

// ─── 5. npm-publish.yml: Fix package names ────────────────────────────────
{
  const p = path.join(ROOT, '..', '.github', 'workflows', 'npm-publish.yml');
  if (!fs.existsSync(p)) { console.log('npm-publish.yml: not found, skip'); }
  else {
    let c = fs.readFileSync(p, 'utf8');
    const fixes = [
      ['tri-link-devkit', 'afdian-mcp'],
      ['tri-link-mcp', 'github-api-v2'],
      ['tri-link-agent', '.'],
    ];
    for (const [oldName, newName] of fixes) {
      c = c.split(oldName).join(newName);
    }
    // Also fix the working-directory references
    c = c.replace('packages/tri-link-devkit', 'packages/afdian-mcp');
    c = c.replace('packages/tri-link-mcp', 'packages/github-api-v2');
    c = c.replace('working-directory: agent', 'working-directory: agent');
    // Fix the test commands
    c = c.replace('cd packages/tri-link-devkit && node test/index.js', 'cd packages/afdian-mcp && node test/index.js');
    c = c.replace('cd ../../packages/tri-link-mcp && node test/index.js', 'cd ../../packages/github-api-v2 && node test/index.js');
    c = c.replace('cd ../../agent && node test/integration.js', 'cd ../../agent && node test/integration.js');
    // Fix npx install hints
    c = c.replace("echo 'npx @tri-link/mcp'", "echo 'node bin/afdian-daemon.js --help'");
    c = c.replace("echo 'npx @tri-link/devkit init my-repo'", "echo 'node bin/daemon-cli.js start 30'");
    c = c.replace("echo 'npx @tri-link/agent status'", "echo 'node bin/agent-cli.js --status'");
    // Update tags
    c = c.split("publish-mcp").join("publish-afdian");
    c = c.split("publish-devkit").join("publish-github-api");
    c = c.split("publish-agent").join("publish-agent");
    c = c.split("publish-all").join("publish-all");
    fs.writeFileSync(p, c);
    console.log('npm-publish.yml: package names fixed');
  }
}

console.log('\n=== All improvements applied ===');

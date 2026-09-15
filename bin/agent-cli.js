#!/usr/bin/env node
'use strict';
/**
 * Tri-Link Agent CLI
 * Usage:
 *   node bin/agent-cli.js              - Interactive mode
 *   node bin/agent-cli.js "requirement" - Run single requirement
 *   node bin/agent-cli.js --status     - Show status
 *   node bin/agent-cli.js --check      - Run ops health check
 */

const path = require('path');
const { Agent } = require('../agent/src/agent');

const args = process.argv.slice(2);
const agent = new Agent();

if (args.includes('--status') || args.includes('-s')) {
  agent.status();
  process.exit(0);
}

if (args.includes('--check') || args.includes('-c')) {
  (async () => {
    const ops = agent.ops;
    const results = await ops.check();
    console.log(JSON.stringify(results, null, 2));
    if (results.alerts.length > 0) {
      console.log('\n⚠️  Alerts:');
      results.alerts.forEach(a => console.log(`  [${a.level.toUpperCase()}] ${a.check}: ${a.message}`));
      // Auto-fix
      for (const alert of results.alerts) {
        const fix = await ops.autoFix(alert);
        if (fix.fixed) console.log(`  ✅ Fixed: ${fix.action}`);
      }
    } else {
      console.log('\n✅ All systems healthy');
    }
  })();
  process.exit(0);
}

if (args.includes('--plan')) {
  console.log(JSON.stringify(agent.memory.getSummary(), null, 2));
  process.exit(0);
}

// If a requirement is provided as argument
const requirement = args.filter(a => !a.startsWith('--')).join(' ');
if (requirement) {
  console.log(`\n🤖 Agent received requirement: "${requirement}"\n`);
  agent.require(requirement, { autoExecute: true });
  process.exit(0);
}

// Interactive mode
console.log('\nStarting interactive agent...\n');
agent.interact().catch(err => {
  console.error('Agent error:', err.message);
  process.exit(1);
});

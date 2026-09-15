#!/usr/bin/env node
'use strict';
/**
 * Tri-Link Agent CLI v2 - With Self-Learning Brain
 *
 * Usage:
 *   node bin/agent-cli.js              - Interactive mode
 *   node bin/agent-cli.js "requirement" - Run single requirement
 *   node bin/agent-cli.js --status     - Show status + brain report
 *   node bin/agent-cli.js --check      - Run ops health check
 *   node bin/agent-cli.js --learn      - Trigger learning cycle
 *   node bin/agent-cli.js --report     - Show brain learning report
 */

const path = require('path');
const { Agent } = require('../agent/src/agent');

const args = process.argv.slice(2);
const agent = new Agent();

if (args.includes('--report') || args.includes('-r')) {
  const brain = agent.brain;
  const report = brain.getReport();
  console.log('\n=== Agent Brain Report ===\n');
  console.log(`Total Tasks: ${report.totalTasks}`);
  console.log(`Completed: ${report.completedTasks}  Failed: ${report.failedTasks}`);
  console.log(`Success Rate: ${report.successRate}`);
  console.log(`Avg Duration: ${report.avgDuration}`);
  console.log(`Patterns Learned: ${report.patternsDiscovered}`);
  console.log(`Learning Cycles: ${report.learningCycles}\n`);

  if (report.recentReflections.length > 0) {
    console.log('Recent Reflections:');
    report.recentReflections.forEach(r => {
      console.log(`  [${new Date(r.time).toLocaleString()}] Success: ${r.successRate}%`);
      r.insights.forEach(i => console.log(`    → ${i}`));
    });
  }

  if (report.errorPatterns.length > 0) {
    console.log('\nKnown Error Patterns:');
    report.errorPatterns.forEach(e => {
      console.log(`  ! ${e.error.substring(0, 80)}`);
      if (e.fix) console.log(`    Fix: ${e.fix}`);
    });
  }
  console.log('');
  process.exit(0);
}

if (args.includes('--learn') || args.includes('-l')) {
  console.log('Running learning cycle...');
  agent.brain._reflect();
  agent.brain.save();
  console.log('Learning cycle complete.');
  console.log(JSON.stringify(agent.brain.getReport(), null, 2));
  process.exit(0);
}

if (args.includes('--status') || args.includes('-s')) {
  agent.status();
  const report = agent.brain.getReport();
  console.log('\n🧠 Brain Status:');
  console.log(`  Tasks: ${report.totalTasks}  Success: ${report.successRate}  Patterns: ${report.patternsDiscovered}`);
  console.log('');
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

const requirement = args.filter(a => !a.startsWith('--')).join(' ');
if (requirement) {
  console.log(`\n🤖 Agent received: "${requirement}"`);
  console.log('🧠 Analyzing with learned patterns...\n');

  // Get planning hints from brain
  const hints = agent.brain.getPlanningHints(requirement);
  if (hints.length > 0) {
    console.log('📋 Pattern matches:');
    hints.forEach(h => {
      const conf = h.confidence ? ` (confidence: ${Math.round(h.confidence * 100)}%)` : '';
      console.log(`  • ${h.pattern}${conf} — est: ${h.estimate}`);
    });
    console.log('');
  }

  const plan = agent.require(requirement, { autoExecute: true });
  console.log(`\n📌 Plan created: ${plan.tasks.length} tasks`);
  plan.tasks.forEach((t, i) => {
    const prio = t.priority === 'critical' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'medium' ? '🟡' : '🟢';
    console.log(`   ${prio} [${i + 1}] ${t.title} (${t.estimate})`);
  });
  process.exit(0);
}

// Interactive mode
console.log('\n🤖 Tri-Link Autonomous Agent v2.0 (Self-Learning)\n');
console.log('Commands: help, status, plan, tasks, run, learn, report, clear, quit\n');
agent.interact().catch(err => {
  console.error('Agent error:', err.message);
  process.exit(1);
});

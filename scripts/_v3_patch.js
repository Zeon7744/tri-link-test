// Patch agent.js and CLI
const fs = require('fs');
const path = require('path');

const root = 'D:/项目/开发部/github/tri-link-test';

// 1. Patch agent.js
const agentPath = path.join(root, 'agent/src/agent.js');
let agentContent = fs.readFileSync(agentPath, 'utf8');

if (!agentContent.includes('require(\'./analytics\')')) {
  agentContent = agentContent.replace(
    "const { Optimizer } = require('./optimizer');",
    `const { Optimizer } = require('./optimizer');
const { Analytics } = require('./analytics');
const { MonetizationPlanner } = require('./monetization');
const { SmartOps } = require('./smartops');`
  );

  agentContent = agentContent.replace(
    'this.optimizer = new Optimizer(this.brain);',
    `this.optimizer = new Optimizer(this.brain);
    this.analytics = new Analytics(this.brain, this.memory);
    this.monetization = new MonetizationPlanner(this.memory, this.analytics);
    this.smartops = new SmartOps(this);`
  );

  fs.writeFileSync(agentPath, agentContent, 'utf8');
  console.log('Patched agent.js');
} else {
  console.log('agent.js already patched');
}

// 2. Patch CLI
const cliPath = path.join(root, 'bin/agent-cli.js');
let cliContent = fs.readFileSync(cliPath, 'utf8');

if (!cliContent.includes('--analyze')) {
  const newCommands = `
if (args.includes('--analyze') || args.includes('-a')) {
  const analytics = agent.analytics;
  const result = analytics.analyze();
  console.log('\\n=== Analytics Report ===\\n');
  console.log('Summary:', JSON.stringify(result.summary, null, 2));
  console.log('Trends:', result.trends.trend + ' (' + result.trends.note + ')');
  if (result.risks.length > 0) {
    console.log('\\nRisks:');
    result.risks.forEach(r => console.log('  [' + r.level.toUpperCase() + '] ' + r.message));
  }
  if (result.opportunities.length > 0) {
    console.log('\\nOpportunities:');
    result.opportunities.forEach(o => console.log('  [*] ' + o.message));
  }
  if (result.recommendations.length > 0) {
    console.log('\\nRecommendations:');
    result.recommendations.forEach(r => console.log('  [' + r.priority.toUpperCase() + '] ' + r.action));
  }
  console.log('');
  process.exit(0);
}

if (args.includes('--monetize') || args.includes('-m')) {
  const plan = agent.monetization.createPlan();
  console.log('\\n=== Monetization Plan ===\\n');
  console.log('Readiness Score: ' + plan.readiness.score + '/100 (' + plan.readiness.level + ')');
  console.log('Details:', plan.readiness.details.join(', '));
  console.log('\\nPhases:');
  plan.phases.forEach(p => {
    console.log('  [' + p.priority.toUpperCase() + '] ' + p.name);
    p.tasks.forEach(t => console.log('    - ' + t.title + ' (' + t.estimate + ', impact: ' + t.impact + ')'));
  });
  console.log('\\nRevenue Streams:');
  plan.revenueStreams.forEach(s => {
    console.log('  ' + s.name + ': ' + s.potential + ' - ' + s.status + ' (target: ' + s.target + ')');
  });
  console.log('');
  process.exit(0);
}

if (args.includes('--smartops') || args.includes('-s')) {
  agent.smartops.start(60000);
  console.log('SmartOps running. Press Ctrl+C to stop.');
  return;
}
`;
  cliContent = cliContent.replace('if (args.includes(\'--plan\')) {', newCommands + 'if (args.includes(\'--plan\')) {');
  fs.writeFileSync(cliPath, cliContent, 'utf8');
  console.log('Patched agent-cli.js');
} else {
  console.log('CLI already patched');
}

console.log('All patches applied');

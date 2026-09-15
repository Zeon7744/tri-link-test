// Patch all agent source files
const fs = require('fs');
const path = require('path');

const root = 'D:/项目/开发部/github/tri-link-test';

function patch(file, from, to) {
  const fpath = path.join(root, file);
  let content = fs.readFileSync(fpath, 'utf8');
  if (content.includes(to)) {
    console.log(`SKIP ${file} - already patched`);
    return;
  }
  content = content.replace(from, to);
  fs.writeFileSync(fpath, content, 'utf8');
  console.log(`PATCHED ${file}`);
}

// 1. agent.js - add imports and init
patch(
  'agent/src/agent.js',
  "const { Brain } = require('./brain');",
  `const { Brain } = require('./brain');
const { Heartbeat } = require('./heartbeat');
const { CodeGen } = require('./codegen');
const { Optimizer } = require('./optimizer');`
);

patch(
  'agent/src/agent.js',
  '    this.brain = new Brain();',
  `    this.brain = new Brain();
    this.heartbeat = new Heartbeat(this);
    this.codegen = new CodeGen();
    this.optimizer = new Optimizer(this.brain);`
);

patch(
  'agent/src/agent.js',
  '    const plan = this.planner.createPlan(requirement, options);',
  `    const hints = this.brain.getPlanningHints(requirement);
    this.memory.set('brainHints', hints);
    const plan = this.planner.createPlan(requirement, options);`
);

// 2. planner.js - update parseRequirement signature
patch(
  'agent/src/planner.js',
  'parseRequirement(requirement) {',
  'parseRequirement(requirement, brainHints) {'
);

// 3. agent-cli.js - add --auto, --optimize commands
patch(
  'bin/agent-cli.js',
  "if (args.includes('--plan')) {",
  `if (args.includes('--auto') || args.includes('-a')) {
  // Auto mode: parse + plan + execute + learning cycle
  const requirement = args.filter(a => !a.startsWith('--')).join(' ');
  if (!requirement) {
    console.log('Usage: node bin/agent-cli.js --auto "your requirement"');
    process.exit(1);
  }
  console.log(\`\\n🤖 Auto mode: "\${requirement}"\\n\`);
  const hints = agent.brain.getPlanningHints(requirement);
  if (hints.length > 0) {
    console.log('🧠 Pattern matches:');
    hints.forEach(h => {
      const conf = h.confidence ? \` (confidence: \${Math.round(h.confidence * 100)}%)\` : '';
      console.log(\`  • \${h.pattern}\${conf} — est: \${h.estimate}\`);
    });
    console.log('');
  }
  agent.require(requirement, { autoExecute: true });
  process.exit(0);
}

if (args.includes('--optimize') || args.includes('-o')) {
  // Run optimization analysis
  const optimizer = agent.optimizer;
  const analysis = optimizer.analyze();
  console.log('\\n=== Optimization Report ===\\n');
  console.log(analysis.note);
  if (analysis.suggestions.length > 0) {
    console.log('\\nSuggestions:');
    analysis.suggestions.forEach(s => console.log('  • ' + s.hint));
  } else {
    console.log('No optimization suggestions yet.');
  }
  console.log('');
  process.exit(0);
}

if (args.includes('--codegen')) {
  // List available code generators
  console.log('\\n=== Available Code Generators ===\\n');
  console.log('  MCP Server:  node bin/agent-cli.js --codegen mcp <name> [description]');
  console.log('  Dashboard:   node bin/agent-cli.js --codegen widget <name> [options]');
  console.log('');
  process.exit(0);
}

if (args[0] === '--codegen') {
  const type = args[1];
  const name = args[2];
  const desc = args[3] || '';
  if (!type || !name) {
    console.log('Usage: node bin/agent-cli.js --codegen <mcp|widget> <name> [description]');
    process.exit(1);
  }
  if (type === 'mcp') {
    const result = agent.codegen.generateMCPServer(name, { description: desc });
    if (result.success) {
      console.log('✅ Generated MCP server at: ' + result.path);
    } else {
      console.log('❌ ' + result.message);
      process.exit(1);
    }
  } else if (type === 'widget') {
    const result = agent.codegen.generateDashboardWidget(name, { title: desc });
    if (result.success) {
      console.log('✅ Generated widget at: ' + result.path);
    } else {
      console.log('❌ ' + result.message);
      process.exit(1);
    }
  } else {
    console.log('Unknown type: ' + type);
    process.exit(1);
  }
  process.exit(0);
}

if (args.includes('--plan')) {`
);

console.log('All patches applied');

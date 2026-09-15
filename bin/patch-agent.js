const fs = require('fs');
const path = require('path');

const agentPath = path.join(__dirname, '..', 'agent', 'src', 'agent.js');
let content = fs.readFileSync(agentPath, 'utf8');

if (!content.includes("require('./brain')")) {
  content = content.replace(
    "const { OpsAgent } = require('./ops');",
    "const { OpsAgent } = require('./ops');\nconst { Brain } = require('./brain');"
  );
  content = content.replace(
    "this.ops = new OpsAgent(this.memory);",
    "this.ops = new OpsAgent(this.memory);\n    this.brain = new Brain();"
  );
  fs.writeFileSync(agentPath, content, 'utf8');
  console.log('Patched agent.js: added Brain import and initialization');
} else {
  console.log('agent.js already has Brain');
}

// Also patch CLI to handle missing brain gracefully
const cliPath = path.join(__dirname, '..', 'bin', 'agent-cli.js');
let cliContent = fs.readFileSync(cliPath, 'utf8');
if (!cliContent.includes('agent.brain')) {
  cliContent = cliContent.replace(
    'const report = brain.getReport();',
    'const report = (agent.brain || { getReport: () => ({ totalTasks: 0, completedTasks: 0, patternsDiscovered: 0 }) }).getReport();'
  );
  cliContent = cliContent.replace(
    'const report = agent.brain.getReport();',
    'const report = (agent.brain || { getReport: () => ({ totalTasks: 0, completedTasks: 0, patternsDiscovered: 0 }) }).getReport();'
  );
  fs.writeFileSync(cliPath, cliContent, 'utf8');
  console.log('Patched agent-cli.js: added brain fallback');
} else {
  console.log('agent-cli.js already patched');
}

console.log('Done');

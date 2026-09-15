const fs = require('fs');
const p = 'D:/项目/开发部/github/tri-link-test/bin/agent-cli.js';
let s = fs.readFileSync(p, 'utf8');
const lines = s.split('\n');

// Find the two codegen blocks
let includeStart = -1, includeEnd = -1;
let arg0Start = -1, arg0End = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("args.includes('--codegen')") && includeStart === -1) {
    includeStart = i;
  }
  if (lines[i].includes("args[0] === '--codegen'") && arg0Start === -1) {
    arg0Start = i;
  }
  if (includeStart >= 0 && lines[i].includes('process.exit(0)')) {
    if (includeEnd === -1) includeEnd = i;
  }
  if (arg0Start >= 0 && lines[i].includes('process.exit(0)')) {
    if (arg0End === -1) arg0End = i;
  }
}

console.log('include:', includeStart, '-', includeEnd);
console.log('arg0:', arg0Start, '-', arg0End);

// Rebuild: put arg0 block first, then includes block
// But actually we want: arg0 block first (handles --codegen with args),
// then includes block (handles --codegen alone for help)
const before = lines.slice(0, arg0Start).join('\n') + '\n';
const arg0Block = lines.slice(arg0Start, arg0End + 1).join('\n');
const between = lines.slice(includeEnd + 1, arg0Start).join('\n');
const includeBlock = lines.slice(includeStart, includeEnd + 1).join('\n');
const after = lines.slice(arg0End + 1).join('\n');

const newOrder = before + arg0Block + '\n' + between + includeBlock + '\n' + after;
fs.writeFileSync(p, newOrder, 'utf8');
console.log('DONE - reordered codegen blocks');

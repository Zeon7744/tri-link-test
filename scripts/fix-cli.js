#!/usr/bin/env node
'use strict';
/**
 * Fix agent-cli.js: remove broken --daemon block, add daemon reference
 */
const fs = require('fs');
const path = require('path');

const cliPath = path.resolve(__dirname, '../bin/agent-cli.js');
let content = fs.readFileSync(cliPath, 'utf8');

// Remove the broken --daemon block
const startMarker = "if (args.includes('--daemon')";
const endMarker = "console.log('\\n🤖 Tri-Link Autonomous Agent v2.0";
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found, skip cleanup');
  process.exit(0);
}

// Remove the block including blank lines after it
const beforeBlock = content.substring(0, startIdx).replace(/\n\s*$/, '');
const afterBlock = content.substring(endIdx);
content = beforeBlock + '\n\n' + afterBlock;

fs.writeFileSync(cliPath, content);
console.log('agent-cli.js cleaned successfully');

#!/usr/bin/env node
'use strict';
/**
 * Add --daemon command to agent-cli.js
 */
const fs = require('fs');
const path = require('path');

const cliPath = path.resolve(__dirname, '../bin/agent-cli.js');
let content = fs.readFileSync(cliPath, 'utf8');

const daemonBlock = `
if (args.includes('--daemon') || args.includes('-d')) {
  const spawn = require('child_process').spawn;
  const daemonPath = require('path').resolve(__dirname, 'afdian-daemon.js');
  const subArgs = args.filter(a => a !== '--daemon' && a !== '-d');
  const cmd = subArgs[0] || 'start';
  const interval = subArgs[1] ? parseInt(subArgs[1], 10) : undefined;
  const childArgs = [cmd];
  if (interval) childArgs.push(String(interval));
  const child = spawn(process.execPath, [daemonPath, ...childArgs], { stdio: 'inherit', detached: false });
  child.on('exit', (code) => { process.exit(code || 0); });
  child.on('error', (err) => { console.error('Daemon error:', err.message); process.exit(1); });
  return;
}

`;

// Insert before the smartops block
const smartopsMarker = 'if (args.includes(\'--smartops\')';
if (content.includes(smartopsMarker) && !content.includes('--daemon')) {
  content = content.replace(smartopsMarker, daemonBlock + smartopsMarker);
  fs.writeFileSync(cliPath, content);
  console.log('Added --daemon command to agent-cli.js');
} else if (content.includes('--daemon')) {
  console.log('--daemon command already present');
} else {
  console.log('smartops marker not found, checking content...');
  console.log(content.slice(-500));
}

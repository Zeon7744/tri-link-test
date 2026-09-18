#!/usr/bin/env node
'use strict';
/**
 * Daemon wrapper - calls afdian-daemon.js with all args passed through.
 * Use: node bin/daemon-cli.js <start|stop|restart|status|fetch|logs> [interval]
 */
const { spawn } = require('child_process');
const path = require('path');

const daemonPath = path.resolve(__dirname, 'afdian-daemon.js');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
tri-link daemon
Usage:
  node bin/daemon-cli.js start [minutes]   - Start daemon (foreground)
  node bin/daemon-cli.js stop              - Stop running daemon
  node bin/daemon-cli.js restart [minutes] - Restart daemon
  node bin/daemon-cli.js status            - Show daemon status
  node bin/daemon-cli.js fetch             - One-shot fetch
  node bin/daemon-cli.js logs              - Show recent logs
`);
  process.exit(0);
}

const child = spawn(process.execPath, [daemonPath, ...args], {
  stdio: 'inherit',
  detached: false,
});

child.on('exit', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error('Daemon error:', err.message);
  process.exit(1);
});

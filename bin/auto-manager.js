'use strict';
/**
 * Tri-Link Auto Manager
 * Unified daemon orchestration: auto-restart, health monitoring, resource guard.
 *
 * Tracks: auto-maintain, afdian-daemon, agent-ops
 * Actions: restart dead daemons, rotate logs, enforce resource limits
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'auto-manager.log');
const STATE_FILE = path.join(DATA_DIR, 'auto-manager-state.json');

const DAEMONS = [
  {
    name: 'auto-maintain',
    script: 'auto-maintain.js',
    pidFile: 'maintain.pid',
    args: ['start', '10'],
    intervalMin: 10,
  },
  {
    name: 'afdian-daemon',
    script: 'afdian-daemon.js',
    pidFile: 'daemon.pid',
    args: ['start', '30'],
    intervalMin: 30,
  },
  {
    name: 'agent-ops',
    script: 'agent-ops.js',
    pidFile: 'agent-ops.pid',
    args: ['start', '15'],
    intervalMin: 15,
  },
];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function getPid(name) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, name), 'utf8').trim();
    return parseInt(raw, 10) || 0;
  } catch { return 0; }
}

function writePid(name, pid) {
  try { fs.writeFileSync(path.join(DATA_DIR, name), String(pid)); } catch {}
}

function restartDaemon(daemon) {
  const scriptPath = path.join(__dirname, daemon.script);
  const proc = spawn(process.execPath, [scriptPath, ...daemon.args], {
    cwd: path.join(__dirname, '..'),
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  writePid(daemon.pidFile, proc.pid);
  log(`${daemon.name} restarted (PID ${proc.pid})`);
  return proc.pid;
}

function rotateLog(fileName, maxLines = 1000) {
  const logPath = path.join(DATA_DIR, fileName);
  try {
    if (!fs.existsSync(logPath)) return;
    const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    if (lines.length > maxLines) {
      fs.writeFileSync(logPath, lines.slice(-maxLines).join('\n') + '\n');
      log(`Rotated ${fileName} (${lines.length} -> ${maxLines} lines)`);
    }
  } catch {}
}

function checkResourceHealth() {
  const warnings = [];
  try {
    const mem = process.memoryUsage();
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    if (rssMB > 512) warnings.push(`High memory: ${rssMB}MB`);

    const now = Date.now();
    for (const daemon of DAEMONS) {
      const pid = getPid(daemon.pidFile);
      if (pid && !isAlive(pid)) {
        warnings.push(`${daemon.name} PID ${pid} dead`);
      }
    }
  } catch {}
  return warnings;
}

function healthCheck() {
  const results = {};
  for (const daemon of DAEMONS) {
    const pid = getPid(daemon.pidFile);
    const alive = isAlive(pid);
    results[daemon.name] = { pid, alive };
    if (!alive) {
      restartDaemon(daemon);
    }
  }
  const resWarnings = checkResourceHealth();
  if (resWarnings.length > 0) log('Resource warnings: ' + resWarnings.join(', '));
  return { ...results, warnings: resWarnings, timestamp: new Date().toISOString() };
}

function start(intervalMs = 5 * 60 * 1000) {
  log(`Auto-manager started (interval: ${Math.round(intervalMs / 60000)}min, PID ${process.pid})`);
  const tick = () => {
    try {
      const h = healthCheck();
      log(`Health: ${JSON.stringify(h)}`);
      rotateLog('maintain.log');
      rotateLog('agent-ops.log');
      rotateLog('daemon.log');
    } catch (e) {
      log('Health check error: ' + e.message);
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);

  process.on('SIGINT', () => { log('Auto-manager stopped'); clearInterval(timer); process.exit(0); });
  process.on('SIGTERM', () => { log('Auto-manager stopped'); clearInterval(timer); process.exit(0); });
}

const cmd = process.argv[2] || 'check';
switch (cmd) {
  case 'check':
    console.log(JSON.stringify(healthCheck(), null, 2));
    break;
  case 'start':
    start(parseInt(process.argv[3], 10) * 60000 || 5 * 60 * 1000);
    break;
  case 'stop': {
    try {
      const pid = getPid('auto-manager.pid');
      if (pid && isAlive(pid)) { process.kill(pid, 'SIGTERM'); log('Stopped'); }
      else log('Not running');
    } catch { log('Not running'); }
    break;
  }
  default:
    console.log('Usage: node auto-manager.js <check|start|stop>');
}

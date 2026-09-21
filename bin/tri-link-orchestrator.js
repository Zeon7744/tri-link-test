'use strict';
/**
 * Tri-Link Orchestrator - Master Daemon
 * Unified entry point for all 5 capabilities:
 *   1. Auto Manager   - daemon orchestration, auto-restart
 *   2. Quality Inspect - deep code/dep/security inspection
 *   3. Alert & Heal   - anomaly detection, auto-repair, escalation
 *   4. Dialogue Exchange - scheduled data collection + trend analysis + brain learning
 *   5. Agent Ops      - risk scan, scoring, self-heal
 *
 * CLI:
 *   node tri-link-orchestrator.js start [minutes]  - Start all daemons
 *   node tri-link-orchestrator.js stop             - Stop all daemons
 *   node tri-link-orchestrator.js status           - Show all daemon status
 *   node tri-link-orchestrator.js cycle            - Run one full orchestration cycle
 *   node tri-link-orchestrator.js report           - Full system report
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'orchestrator.log');
const PID_FILE = path.join(DATA_DIR, 'orchestrator.pid');
const STATE_FILE = path.join(DATA_DIR, 'orchestrator-state.json');

const MODULES = [
  {
    name: 'auto-manager',
    script: 'auto-manager.js',
    pidFile: 'auto-manager.pid',
    startArgs: ['start', '5'],
  },
  {
    name: 'alert-healer',
    script: 'alert-healer.js',
    pidFile: 'alert-healer.pid',
    startArgs: ['start', '10'],
  },
  {
    name: 'dialogue-exchange',
    script: 'dialogue-exchange.js',
    pidFile: 'dialogue.pid',
    startArgs: ['start', '30'],
  },
  {
    name: 'agent-ops',
    script: 'agent-ops.js',
    pidFile: 'agent-ops.pid',
    startArgs: ['start', '15'],
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

function readPid(file) {
  try { return parseInt(fs.readFileSync(path.join(DATA_DIR, file), 'utf8').trim(), 10) || 0; } catch { return 0; }
}

function startModule(mod) {
  const pid = readPid(mod.pidFile);
  if (isAlive(pid)) {
    log(`${mod.name}: already running (PID ${pid})`);
    return pid;
  }
  const proc = spawn(process.execPath, [path.join(__dirname, mod.script), ...mod.startArgs], {
    cwd: path.join(__dirname, '..'),
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(path.join(DATA_DIR, mod.pidFile), String(proc.pid)); } catch {}
  log(`${mod.name}: started (PID ${proc.pid})`);
  return proc.pid;
}

function stopModule(mod) {
  const pid = readPid(mod.pidFile);
  if (isAlive(pid)) {
    process.kill(pid, 'SIGTERM');
    log(`${mod.name}: stopped (PID ${pid})`);
  } else {
    log(`${mod.name}: not running`);
  }
  try { fs.unlinkSync(path.join(DATA_DIR, mod.pidFile)); } catch {}
}

function getStatus() {
  const status = {};
  for (const mod of MODULES) {
    const pid = readPid(mod.pidFile);
    status[mod.name] = { pid: pid || null, running: isAlive(pid) };
  }
  // Also check the core daemons
  status['auto-maintain'] = { pid: readPid('maintain.pid') || null, running: isAlive(readPid('maintain.pid')) };
  status['afdian-daemon'] = { pid: readPid('daemon.pid') || null, running: isAlive(readPid('daemon.pid')) };
  return status;
}

function runCycle() {
  log('=== Orchestrator Cycle ===');
  const status = getStatus();
  log('Daemon status: ' + JSON.stringify(status));

  // Start any dead modules
  for (const mod of MODULES) {
    if (!status[mod.name].running) {
      startModule(mod);
    }
  }

  // Ensure core daemons are running
  for (const core of ['maintain.pid', 'daemon.pid']) {
    const pid = readPid(core);
    if (!isAlive(pid)) {
      const script = core === 'maintain.pid' ? 'auto-maintain.js' : 'afdian-daemon.js';
      const args = core === 'maintain.pid' ? ['start', '10'] : ['start', '30'];
      log(`${script} dead, restarting...`);
      const proc = spawn(process.execPath, [path.join(__dirname, script), ...args], {
        cwd: path.join(__dirname, '..'),
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
      try { fs.writeFileSync(path.join(DATA_DIR, core), String(proc.pid)); } catch {}
      log(`${script} restarted (PID ${proc.pid})`);
    }
  }

  // Run one-shot quality inspection
  try {
    const result = spawnSync('quality-inspector');
    if (result !== null) log('Quality inspection triggered');
  } catch {}

  // Run alert check
  try {
    const result = spawnSync('alert-healer');
    if (result !== null) log('Alert check triggered');
  } catch {}

  // Run dialogue exchange
  try {
    const result = spawnSync('dialogue-exchange');
    if (result !== null) log('Dialogue exchange triggered');
  } catch {}

  // Save state
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      lastCycle: new Date().toISOString(),
      status,
    }, null, 2));
  } catch {}

  log('Orchestrator cycle complete.');
}

// Simple sync spawn wrapper
function spawnSync(moduleName) {
  const { spawnSync: nodeSpawnSync } = require('child_process');
  let script;
  switch (moduleName) {
    case 'quality-inspector': script = 'quality-inspector.js'; break;
    case 'alert-healer': script = 'alert-healer.js'; break;
    case 'dialogue-exchange': script = 'dialogue-exchange.js'; break;
    default: return null;
  }
  const args = moduleName === 'quality-inspector' ? ['inspect'] :
               moduleName === 'alert-healer' ? ['check'] :
               ['exchange'];
  const result = nodeSpawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  if (result.status === 0) return result.stdout;
  return null;
}

function start(intervalMin = 15) {
  const intervalMs = intervalMin * 60 * 1000;
  log(`Orchestrator started (interval: ${intervalMin}min, PID ${process.pid})`);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}

  // Start all sub-daemons
  for (const mod of MODULES) {
    startModule(mod);
  }

  const tick = () => {
    try { runCycle(); } catch (e) { log('Cycle error: ' + e.message); }
  };
  tick();
  const timer = setInterval(tick, intervalMs);

  const shutdown = () => {
    log('Orchestrator shutting down...');
    clearInterval(timer);
    for (const mod of MODULES) stopModule(mod);
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function fullReport() {
  const status = getStatus();
  console.log('\n=== Tri-Link Orchestrator Report ===\n');

  // Daemon status
  console.log('Daemon Status:');
  for (const [name, s] of Object.entries(status)) {
    const icon = s.running ? 'RUNNING' : 'STOPPED';
    console.log(`  ${icon.padEnd(8)} ${name} (PID: ${s.pid || '---'})`);
  }

  // Alert status
  try {
    const alerts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'alerts.json'), 'utf8'));
    const active = alerts.activeAlerts || [];
    console.log(`\nActive Alerts: ${active.length}`);
    for (const a of active) {
      console.log(`  [${a.level.toUpperCase()}] ${a.message}`);
    }
  } catch {}

  // Quality report
  try {
    const q = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'quality-state.json'), 'utf8'));
    console.log(`\nQuality Report (${q.lastRun}):`);
    for (const [name, r] of Object.entries(q.results || {})) {
      const icon = r.pass ? 'PASS' : 'FAIL';
      console.log(`  [${icon}] ${name}: ${r.grade} (${r.score}/100) - ${r.findingCount} findings`);
    }
  } catch {}

  // Dialogue exchange
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dialogue-state.json'), 'utf8'));
    console.log(`\nLast Exchange: ${d.lastExchange || 'never'}`);
    if (d.insights?.length > 0) {
      console.log('Recent Insights:');
      for (const i of d.insights.slice(-5)) {
        console.log(`  [${i.type}] ${i.message}`);
      }
    }
  } catch {}

  // Brain status
  try {
    const brain = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'brain.json'), 'utf8'));
    console.log(`\nBrain: cycles=${brain.selfState?.cycles || 0} health=${brain.selfState?.health || 'unknown'}`);
    console.log(`  Decisions: ${brain.decisions?.length || 0}, Learned: ${brain.learned?.length || 0}`);
  } catch {}

  console.log('');
}

// ── CLI ───────────────────────────────────────────────────────
const cmd = process.argv[2] || 'status';
switch (cmd) {
  case 'start':
    start(parseInt(process.argv[3], 10) || 15);
    break;
  case 'stop':
    for (const mod of MODULES) stopModule(mod);
    // Also stop core daemons
    for (const core of ['maintain.pid', 'daemon.pid', 'agent-ops.pid']) {
      const pid = readPid(core);
      if (isAlive(pid)) { process.kill(pid, 'SIGTERM'); log(`${core} stopped`); }
    }
    try { fs.unlinkSync(PID_FILE); } catch {}
    log('All stopped.');
    break;
  case 'status':
    console.log(JSON.stringify(getStatus(), null, 2));
    break;
  case 'cycle':
    runCycle();
    break;
  case 'report':
    fullReport();
    break;
  default:
    console.log(`
Tri-Link Orchestrator v1.0
Usage:
  node tri-link-orchestrator.js start [minutes]  - Start all daemons + orchestrator
  node tri-link-orchestrator.js stop            - Stop all
  node tri-link-orchestrator.js status          - Show daemon status
  node tri-link-orchestrator.js cycle           - Run one full cycle
  node tri-link-orchestrator.js report          - Full system report
`);
}

'use strict';
/**
 * Alert & Self-Heal Engine
 * Monitors all system components, detects anomalies, auto-repairs, escalates.
 *
 * CLI:
 *   node alert-healer.js check         - One-shot health check
 *   node alert-healer.js start [min]   - Start daemon
 *   node alert-healer.js stop          - Stop daemon
 *   node alert-healer.js status        - Show status
 *   node alert-healer.js alerts        - Show active alerts
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'alert-healer.log');
const STATE_FILE = path.join(DATA_DIR, 'alert-state.json');
const PID_FILE = path.join(DATA_DIR, 'alert-healer.pid');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function git(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(file) {
  try { return parseInt(fs.readFileSync(path.join(DATA_DIR, file), 'utf8').trim(), 10) || 0; } catch { return 0; }
}

// Load project config
const amPath = path.join(__dirname, 'auto-maintain.js');
let PROJECTS = [];
try {
  const src = fs.readFileSync(amPath, 'utf8');
  const m = src.match(/projects:\s*\[([\s\S]*?)\n\s*\],/);
  if (m) PROJECTS = eval('[' + m[1] + ']');
} catch {}

// ── Health Checks ─────────────────────────────────────────────
function checkDaemons() {
  const alerts = [];
  const daemons = [
    { name: 'auto-maintain', pidFile: 'maintain.pid', script: 'auto-maintain.js', args: ['start', '10'] },
    { name: 'afdian-daemon', pidFile: 'daemon.pid', script: 'afdian-daemon.js', args: ['start', '30'] },
    { name: 'agent-ops', pidFile: 'agent-ops.pid', script: 'agent-ops.js', args: ['start', '15'] },
  ];

  for (const d of daemons) {
    const pid = readPid(d.pidFile);
    const alive = isAlive(pid);
    if (!alive) {
      alerts.push({
        id: `daemon-${d.name}`,
        level: 'critical',
        source: 'daemon',
        message: `${d.name} is not running`,
        time: new Date().toISOString(),
        autoFixable: true,
      });
      log(`ALERT: ${d.name} not running, restarting...`);
      try {
        const proc = spawn(process.execPath, [path.join(__dirname, d.script), ...d.args], {
          cwd: path.join(__dirname, '..'),
          detached: true,
          stdio: 'ignore',
        });
        proc.unref();
        fs.writeFileSync(path.join(DATA_DIR, d.pidFile), String(proc.pid));
        log(`${d.name} restarted (PID ${proc.pid})`);
        alerts[alerts.length - 1].resolved = true;
        alerts[alerts.length - 1].resolution = `restarted PID ${proc.pid}`;
      } catch (e) {
        log(`Failed to restart ${d.name}: ${e.message}`);
      }
    }
  }
  return alerts;
}

function checkProjectHealth() {
  const alerts = [];
  for (const project of PROJECTS) {
    const local = project.local;
    if (!fs.existsSync(local)) {
      alerts.push({
        id: `project-${project.name}-missing`,
        level: 'critical',
        source: 'project',
        message: `${project.name} local path missing: ${local}`,
        time: new Date().toISOString(),
        autoFixable: false,
      });
      continue;
    }

    // Check uncommitted changes
    const status = git('git status --short', local);
    if (status && status.trim()) {
      const count = status.split('\n').filter(Boolean).length;
      if (count > 10) {
        alerts.push({
          id: `project-${project.name}-dirty`,
          level: 'warning',
          source: 'project',
          message: `${project.name} has ${count} uncommitted changes`,
          time: new Date().toISOString(),
          autoFixable: true,
        });
        log(`Auto-committing ${project.name} (${count} changes)...`);
        try {
          git('git add -A', local);
          git(`git commit -m "chore(alert-healer): auto-commit ${count} pending changes"`, local);
          git('git push origin main 2>&1 || true', local);
          git('git push gitee main 2>&1 || true', local);
          alerts[alerts.length - 1].resolved = true;
          alerts[alerts.length - 1].resolution = 'auto-committed and pushed';
          log(`${project.name} auto-committed and pushed`);
        } catch (e) {
          log(`Auto-commit failed for ${project.name}: ${e.message}`);
        }
      }
    }

    // Check git remote connectivity
    const lsRemote = git('git ls-remote origin main', local);
    if (!lsRemote) {
      alerts.push({
        id: `project-${project.name}-remote`,
        level: 'high',
        source: 'project',
        message: `${project.name} cannot reach GitHub remote`,
        time: new Date().toISOString(),
        autoFixable: false,
      });
    }
  }
  return alerts;
}

function checkDiskSpace() {
  const alerts = [];
  try {
    const output = execSync('wmic logicaldisk where "Caption=\'D:\'" get FreeSpace', { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'ignore'] });
    const freeBytes = parseInt(output.match(/(\d{10,})/)?.[1] || '0', 10);
    const freeGB = Math.round(freeBytes / 1024 / 1024 / 1024 * 10) / 10;
    if (freeGB < 5) {
      alerts.push({
        id: 'disk-space',
        level: 'critical',
        source: 'system',
        message: `Low disk space on D: (${freeGB}GB free)`,
        time: new Date().toISOString(),
        autoFixable: false,
      });
    }
  } catch {}
  return alerts;
}

function checkAFDian() {
  const alerts = [];
  try {
    const state = readPid('daemon.pid');
    if (state && !isAlive(state)) {
      alerts.push({
        id: 'afdian-dead',
        level: 'high',
        source: 'afdian',
        message: 'AFDian daemon not running',
        time: new Date().toISOString(),
        autoFixable: true,
      });
    }
  } catch {}
  return alerts;
}

// ── Full check ────────────────────────────────────────────────
function runFullCheck() {
  log('=== Alert & Heal Check ===');
  const allAlerts = [
    ...checkDaemons(),
    ...checkProjectHealth(),
    ...checkDiskSpace(),
    ...checkAFDian(),
  ];

  // Save alerts
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const existing = (() => {
      try { return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')); } catch { return []; }
    })();
    const active = allAlerts.filter(a => !a.resolved);
    fs.writeFileSync(ALERTS_FILE, JSON.stringify({
      lastCheck: new Date().toISOString(),
      activeAlerts: active,
      resolvedAlerts: allAlerts.filter(a => a.resolved),
      history: [...existing, ...active.map(a => ({
        id: a.id,
        level: a.level,
        message: a.message,
        time: a.time,
        resolved: a.resolved,
        resolution: a.resolution,
      }))].slice(-200),
    }, null, 2));
  } catch {}

  const critical = allAlerts.filter(a => a.level === 'critical').length;
  const high = allAlerts.filter(a => a.level === 'high').length;
  const warnings = allAlerts.filter(a => a.level === 'warning').length;
  const resolved = allAlerts.filter(a => a.resolved).length;

  log(`Done: ${critical} critical, ${high} high, ${warnings} warnings, ${resolved} auto-resolved`);
  return { critical, high, warnings, resolved, alerts: allAlerts };
}

// ── Daemon mode ───────────────────────────────────────────────
function start(intervalMin = 10) {
  const intervalMs = intervalMin * 60 * 1000;
  log(`Alert-healer started (interval: ${intervalMin}min, PID ${process.pid})`);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}

  const tick = () => {
    try { runFullCheck(); } catch (e) { log('Check error: ' + e.message); }
  };
  tick();
  const timer = setInterval(tick, intervalMs);

  const shutdown = () => {
    log('Alert-healer stopped');
    clearInterval(timer);
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ── CLI ───────────────────────────────────────────────────────
const cmd = process.argv[2] || 'check';
switch (cmd) {
  case 'check':
    runFullCheck();
    break;
  case 'start':
    start(parseInt(process.argv[3], 10) || 10);
    break;
  case 'stop': {
    const pid = readPid('alert-healer.pid');
    if (pid && isAlive(pid)) {
      process.kill(pid, 'SIGTERM');
      log('Stopped');
    } else log('Not running');
    try { fs.unlinkSync(PID_FILE); } catch {}
    break;
  }
  case 'status': {
    const pid = readPid('alert-healer.pid');
    const alive = isAlive(pid);
    let alerts = [];
    try { alerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')).activeAlerts || []; } catch {}
    console.log(JSON.stringify({
      running: alive,
      pid: pid || null,
      activeAlerts: alerts.length,
      lastCheck: (() => { try { return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')).lastCheck; } catch { return null; } })(),
    }, null, 2));
    break;
  }
  case 'alerts':
    try {
      const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
      console.log(`\n=== Active Alerts (${data.activeAlerts?.length || 0}) ===\n`);
      for (const a of data.activeAlerts || []) {
        console.log(`  [${a.level.toUpperCase()}] ${a.message}`);
        if (a.resolution) console.log(`    Resolved: ${a.resolution}`);
      }
      if (data.history?.length > 0) {
        console.log(`\n=== Recent History (${Math.min(data.history.length, 10)}) ===\n`);
        for (const h of data.history.slice(-10)) {
          const icon = h.resolved ? '+' : '!';
          console.log(`  ${icon} [${h.level}] ${h.message}`);
        }
      }
    } catch {
      console.log('No alert data yet.');
    }
    break;
  default:
    console.log('Usage: node alert-healer.js <check|start|stop|status|alerts> [minutes]');
}

#!/usr/bin/env node
'use strict';
/**
 * AFDian Data Fetcher Daemon
 *
 * Periodically fetches sponsor data from AFDian API
 * and stores it locally for analytics and monetization.
 *
 * CLI:
 *   node bin/afdian-daemon.js start   - Start daemon in foreground
 *   node bin/afdian-daemon.js stop    - Stop daemon gracefully
 *   node bin/afdian-daemon.js restart - Restart daemon
 *   node bin/afdian-daemon.js status  - Show daemon status
 *   node bin/afdian-daemon.js fetch   - Single fetch (one-shot)
 *   node bin/afdian-daemon.js logs    - Show recent log lines
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const STATE_FILE = path.join(DATA_DIR, 'daemon-state.json');
const LOG_FILE = path.join(DATA_DIR, 'daemon.log');
const PID_FILE = path.join(DATA_DIR, 'daemon.pid');
const CONFIG_FILE = path.join(HOME, '.local', 'bin', 'afdian-link-config.json');

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const API_BASE = 'https://afdian.com/api/open';

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Config not found: ${CONFIG_FILE}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastFetch: null, lastStatus: null, totalFetches: 0, errors: [], sponsors: [] };
  }
}

function writeState(state) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function appendLog(line) {
  ensureDataDir();
  const ts = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${ts}] ${line}\n`);
  // Keep log under 500 lines
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > 500) {
      fs.writeFileSync(LOG_FILE, lines.slice(-500).join('\n') + '\n');
    }
  } catch {}
}

function signRequest(config, paramsJson) {
  const ts = Math.floor(Date.now() / 1000);
  const raw = `${config.token}params${paramsJson}ts${ts}user_id${config.user_id}`;
  const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
  return { ts, sign };
}

async function fetchData(config, params) {
  const paramsJson = JSON.stringify(params);
  const { ts, sign } = signRequest(config, paramsJson);
  const body = JSON.stringify({ user_id: config.user_id, params: paramsJson, ts, sign });
  const resp = await fetch(`${API_BASE}/query-sponsor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  if (data.ec !== 200) {
    const hints = { 400002: 'timestamp drift', 400003: 'invalid params', 400004: 'invalid token', 400005: 'signature mismatch' };
    throw new Error(`AFDian error ${data.ec}: ${hints[data.ec] || data.em || ''}`);
  }
  return data.data || data;
}

// ─── Single Fetch ───────────────────────────────────────────────────────────

async function doFetch() {
  const config = readConfig();
  appendLog('Starting AFDian data fetch...');
  try {
    // Fetch creator info
    const info = await fetchData(config, { page: 1 });
    // Fetch stats
    let stats = {};
    try { stats = await fetchData(config, { stat: '1' }); } catch (e) { appendLog(`Stats fetch warning: ${e.message}`); }

    const state = readState();
    state.lastFetch = new Date().toISOString();
    state.lastStatus = 'ok';
    state.totalFetches += 1;
    if (state.errors.length > 0) state.errors.shift();
    state.sponsors = info.followers || info.list || info || [];

    writeState(state);
    appendLog(`Fetch OK - total: ${state.totalFetches}, sponsors: ${state.sponsors.length}`);
    console.log('Fetch OK. Total fetches:', state.totalFetches);
    if (state.sponsors.length > 0) {
      console.log('Recent sponsors:', state.sponsors.slice(0, 5).map(s => s.name || s.username || JSON.stringify(s)).join(', '));
    }
    return { ok: true, state };
  } catch (err) {
    const state = readState();
    state.lastStatus = 'error';
    state.errors.push({ time: new Date().toISOString(), message: err.message });
    if (state.errors.length > 20) state.errors.shift();
    writeState(state);
    appendLog(`Fetch FAILED: ${err.message}`);
    console.error('Fetch FAILED:', err.message);
    return { ok: false, error: err.message, state };
  }
}

// ─── Daemon Loop ────────────────────────────────────────────────────────────

let daemonRunning = false;
let daemonTimer = null;

function writePid() {
  ensureDataDir();
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function readPid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10); } catch { return null; }
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch { return false; }
}

function getStatus() {
  const pid = readPid();
  const running = pid && !daemonRunning ? (() => {
    try { process.kill(pid, 0); return true; } catch { return false; }
  })() : daemonRunning;
  const state = readState();
  return { running, pid, lastFetch: state.lastFetch, lastStatus: state.lastStatus, totalFetches: state.totalFetches };
}

function runDaemon(intervalMs = DEFAULT_INTERVAL_MS) {
  if (daemonRunning) {
    console.log('Daemon already running (in this process). Use `stop` first or `status` to check.');
    process.exit(1);
  }

  ensureDataDir();
  const existingPid = readPid();
  if (existingPid && existingPid !== process.pid) {
    const alive = (() => { try { process.kill(existingPid, 0); return true; } catch { return false; } })();
    if (alive) {
      console.log(`Daemon already running with PID ${existingPid}. Use \`stop\` to stop it first.`);
      process.exit(1);
    }
    // Stale PID file, remove it
    try { fs.unlinkSync(PID_FILE); } catch {}
  }

  daemonRunning = true;
  writePid();
  appendLog(`Daemon started (PID=${process.pid}, interval=${intervalMs / 1000 / 60}min)`);
  console.log(`AFDian Daemon started (PID=${process.pid}, interval=${Math.round(intervalMs / 60000)}min)`);

  const tick = async () => {
    try {
      await doFetch();
    } catch (err) {
      appendLog(`Daemon tick error: ${err.message}`);
      console.error('Daemon tick error:', err.message);
    }
  };

  // Run immediately, then on interval
  tick().catch(err => appendLog(`Initial fetch error: ${err.message}`));
  daemonTimer = setInterval(tick, intervalMs);

  const shutdown = async () => {
    appendLog('Daemon shutting down...');
    console.log('\nDaemon shutting down...');
    if (daemonTimer) clearInterval(daemonTimer);
    daemonRunning = false;
    try { fs.unlinkSync(PID_FILE); } catch {}
    writeState(readState());
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];
const interval = parseInt(args[1], 10) || DEFAULT_INTERVAL_MS;

if (!cmd) {
  console.log(`
AFDian Data Fetcher Daemon v1.0
Usage:
  node bin/afdian-daemon.js start [interval-minutes]  - Start daemon (foreground, press Ctrl+C to stop)
  node bin/afdian-daemon.js stop                      - Stop running daemon
  node bin/afdian-daemon.js restart [interval-minutes] - Restart daemon
  node bin/afdian-daemon.js status                    - Show daemon status
  node bin/afdian-daemon.js fetch                     - One-shot fetch
  node bin/afdian-daemon.js logs                      - Show recent log lines
`);
  process.exit(0);
}

(async () => {
  switch (cmd) {
    case 'start':
      runDaemon(interval * 60000);
      break;
    case 'stop':
      const pid = readPid();
      if (pid) {
        if (daemonRunning && pid === process.pid) {
          process.exit(0); // handled by signal
        }
        const killed = killPid(pid);
        try { fs.unlinkSync(PID_FILE); } catch {}
        appendLog(killed ? `Daemon stopped (PID=${pid})` : `Could not stop PID=${pid} (already dead?)`);
        console.log(killed ? `Stopped daemon (PID=${pid})` : 'Daemon not found or already stopped');
      } else {
        console.log('No daemon running (no PID file found)');
      }
      break;
    case 'restart':
      const oldPid = readPid();
      if (oldPid && oldPid !== process.pid) {
        try { process.kill(oldPid, 'SIGTERM'); } catch {}
      }
      await new Promise(r => setTimeout(r, 500));
      runDaemon(interval * 60000);
      break;
    case 'status': {
      const st = getStatus();
      console.log(JSON.stringify(st, null, 2));
      break;
    }
    case 'fetch':
      await doFetch();
      break;
    case 'logs': {
      ensureDataDir();
      try {
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        console.log(lines.slice(-30).join('\n'));
      } catch { console.log('No log file yet.'); }
      break;
    }
    default:
      console.log(`Unknown command: ${cmd}`);
      process.exit(1);
  }
})().catch(err => {
  console.error('Daemon error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';
/**
 * AFDian Daemon - Real-time sponsorship monitoring and event handling
 *
 * Usage:
 *   node afdian-daemon.js start [interval_minutes]
 *   node afdian-daemon.js stop
 *   node afdian-daemon.js status
 *   node afdian-daemon.js fetch
 */
const { AfdianFetcher } = require('./agent/src/afdian-fetcher');
const { Memory } = require('./agent/src/memory');
const { Notification } = require('./agent/src/notification');
const fs = require('fs');
const path = require('path');

const DAEMON_STATE_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.tri-link', 'daemon-state.json');

function loadState() {
  try {
    if (fs.existsSync(DAEMON_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(DAEMON_STATE_PATH, 'utf8'));
    }
  } catch {}
  return { running: false, pid: null, startedAt: null, intervalMs: 3600000 };
}

function saveState(state) {
  const dir = path.dirname(DAEMON_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DAEMON_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function getPIDFile() {
  return path.join(process.env.TEMP || '/tmp', 'tri-link-daemon.pid');
}

function loadConfig() {
  const candidates = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'share', 'afdian-mcp', 'config.json'),
    path.join(process.cwd(), 'config.json'),
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'afdian-link-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    }
  }
  return null;
}

async function fetchAndStore(fetcher, memory, notification) {
  try {
    const results = await fetcher._tick();
    for (const result of results) {
      if (!result.ok) continue;
      if (result.type === 'sponsor_stats') {
        const prevSponsors = memory.data.metrics.afdianSponsors || 0;
        const prevMonthly = memory.data.metrics.monthlyIncome || 0;
        const newSponsors = result.total_sponsors || 0;
        const newMonthly = result.monthly_income || 0;

        memory.updateMetrics({
          afdianSponsors: newSponsors,
          monthlyIncome: newMonthly,
        });

        // Detect milestone events
        if (newSponsors > prevSponsors) {
          const delta = newSponsors - prevSponsors;
          notification.success('sponsor', `New sponsor! Total: ${newSponsors} (+${delta})`);
          if (newSponsors % 5 === 0) {
            notification.info('milestone', `🎉 Reached ${newSponsors} sponsors milestone!`);
          }
          if (newSponsors === 1) {
            notification.info('milestone', '🌟 First sponsor! Check out https://afdian.com/a/Zeon7744');
          }
        }
        if (newMonthly > prevMonthly) {
          notification.info('income', `Monthly income increased: 楼${newMonthly}`);
        }
      }
    }
    memory.save();
  } catch (err) {
    notification.error('daemon', `Fetch error: ${err.message.substring(0, 100)}`);
  }
}

function cmdStart(args) {
  const state = loadState();
  if (state.running) {
    console.log('[Daemon] Already running (PID: ' + state.pid + ')');
    console.log('  Use: node afdian-daemon.js restart');
    process.exit(0);
  }

  const intervalMinutes = args[0] ? parseInt(args[0], 10) : 30;
  const intervalMs = intervalMinutes * 60 * 1000;

  const config = loadConfig();
  if (!config) {
    console.log('[Daemon] ERROR: No AFDian config found.');
    console.log('  Expected: ~/.local/share/afdian-mcp/config.json');
    process.exit(1);
  }

  const token = config.token || process.env.AFDIAN_TOKEN;
  const user = config.creator_page || config.user_id || 'Zeon7744';

  const memory = new Memory();
  const notification = new Notification({ project: 'tri-link-daemon' });

  const fetcher = new AfdianFetcher({
    user,
    token,
    intervalMs,
    onData: (results) => {
      for (const r of results) {
        if (r.ok) {
          notification.info('fetch', `${r.type}: ${JSON.stringify({ total_sponsors: r.total_sponsors, monthly_income: r.monthly_income }).substring(0, 80)}`);
        }
      }
    },
  });

  // Write PID file
  const pidFile = getPIDFile();
  fs.writeFileSync(pidFile, String(process.pid), 'utf8');

  // Save state
  saveState({
    running: true,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    intervalMs,
    user,
    tokenSet: Boolean(token),
  });

  console.log(`[Daemon] Started — user=${user} interval=${intervalMinutes}min`);
  console.log(`[Daemon] PID: ${process.pid}`);
  console.log(`[Daemon] State: ${DAEMON_STATE_PATH}`);
  console.log('[Daemon] Press Ctrl+C to stop\n');

  // Initial fetch
  fetchAndStore(fetcher, memory, notification).catch(() => {});

  // Store references for graceful shutdown
  global.__daemonFetcher = fetcher;
  global.__daemonMemory = memory;
  global.__daemonNotification = notification;

  process.on('SIGINT', () => {
    console.log('\n[Daemon] Stopping...');
    fetcher.stop();
    state.running = false;
    saveState(state);
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    fetcher.stop();
    state.running = false;
    saveState(state);
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    process.exit(0);
  });

  // Keep alive
  fetcher.start(intervalMs);
}

function cmdStop() {
  const state = loadState();
  if (!state.running) {
    console.log('[Daemon] Not running');
    process.exit(0);
  }
  try {
    if (global.__daemonFetcher) global.__daemonFetcher.stop();
  } catch {}
  const newState = { ...state, running: false };
  saveState(newState);
  const pidFile = getPIDFile();
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  console.log('[Daemon] Stopped');
  console.log(JSON.stringify(newState, null, 2));
}

function cmdRestart(args) {
  cmdStop();
  setTimeout(() => cmdStart(args), 500);
}

function cmdStatus() {
  const state = loadState();
  const pidFile = getPIDFile();
  let pidRunning = false;
  if (fs.existsSync(pidFile)) {
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      try { process.kill(pid, 0); pidRunning = true; } catch { pidRunning = false; }
    } catch {}
  }

  console.log('=== AFDian Daemon Status ===');
  console.log(`Running: ${state.running && pidRunning ? 'yes' : 'no'}`);
  console.log(`PID File: ${pidRunning ? 'active' : 'missing/stale'}`);
  console.log(`Started: ${state.startedAt || 'never'}`);
  console.log(`Interval: ${(state.intervalMs / 1000 / 60).toFixed(0)} min`);
  console.log(`State: ${DAEMON_STATE_PATH}`);

  if (state.running && !pidRunning) {
    console.log('\n⚠️  State says running but no PID file found. May be orphaned.');
  }
}

function cmdFetch() {
  const config = loadConfig();
  if (!config) {
    console.log('[Fetch] ERROR: No AFDian config found');
    process.exit(1);
  }
  const token = config.token || process.env.AFDIAN_TOKEN;
  const user = config.creator_page || config.user_id || 'Zeon7744';
  const memory = new Memory();
  const notification = new Notification({ project: 'tri-link-fetch' });

  const fetcher = new AfdianFetcher({ user, token, intervalMs: 99999999 });
  fetcher._tick().then((results) => {
    console.log('\n=== AFDian Fetch Results ===');
    for (const r of results) {
      console.log(`[${r.type}] ok=${r.ok}`);
      if (r.ok) {
        console.log(JSON.stringify(r, null, 2));
      } else if (r.error) {
        console.log(`  Error: ${r.error}`);
      }
    }
    // Store in memory
    const stats = results.find(r => r.type === 'sponsor_stats');
    if (stats && stats.ok) {
      memory.updateMetrics({
        afdianSponsors: stats.total_sponsors,
        monthlyIncome: stats.monthly_income,
      });
      memory.save();
      console.log('\n✅ Metrics updated in memory');
    }
  }).catch(err => {
    console.log('[Fetch] Error:', err.message);
    process.exit(1);
  });
}

// CLI
const cmd = process.argv[2] || 'status';
const restArgs = process.argv.slice(3);

switch (cmd) {
  case 'start':
  case 'begin':
    cmdStart(restArgs);
    break;
  case 'stop':
    cmdStop();
    break;
  case 'restart':
    cmdRestart(restArgs);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'fetch':
    cmdFetch();
    break;
  default:
    console.log('Usage: node afdian-daemon.js <start|stop|restart|status|fetch> [interval_minutes]');
    process.exit(1);
}

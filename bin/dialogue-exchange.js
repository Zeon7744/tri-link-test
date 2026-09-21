'use strict';
/**
 * Dialogue Exchange & Data Analysis Engine
 * Scheduled data exchange: collects metrics from all platforms, performs trend analysis,
 * generates insights, and feeds learning back into the brain.
 *
 * CLI:
 *   node dialogue-exchange.js collect       - Collect data from all sources
 *   node dialogue-exchange.js analyze       - Analyze collected data
 *   node dialogue-exchange.js exchange      - Collect + analyze + learn (full cycle)
 *   node dialogue-exchange.js start [min]   - Start daemon
 *   node dialogue-exchange.js stop          - Stop daemon
 *   node dialogue-exchange.js status        - Show status
 *   node dialogue-exchange.js insights      - Show recent insights
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'dialogue.log');
const STATE_FILE = path.join(DATA_DIR, 'dialogue-state.json');
const PID_FILE = path.join(DATA_DIR, 'dialogue.pid');
const EXCHANGE_FILE = path.join(DATA_DIR, 'exchange-data.json');
const BRAIN_FILE = path.join(DATA_DIR, 'brain.json');

// Load .env
function loadEnv(key) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith(key + '=')) {
          return trimmed.split('=').slice(1).join('=').trim().replace(/\r/g, '');
        }
      }
    }
  } catch {}
  return '';
}

const CONFIG = {
  githubToken: loadEnv('GITHUB_TOKEN'),
  giteeToken: loadEnv('GITEE_TOKEN'),
  owner: 'Zeon7744',
};

// Load projects
const amPath = path.join(__dirname, 'auto-maintain.js');
let PROJECTS = [];
try {
  const src = fs.readFileSync(amPath, 'utf8');
  const m = src.match(/projects:\s*\[([\s\S]*?)\n\s*\],/);
  if (m) PROJECTS = eval('[' + m[1] + ']');
} catch {}

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

// ── Data Collection ───────────────────────────────────────────
function collectGitHub(project) {
  const result = { ok: false };
  try {
    const out = git(`git ls-remote origin HEAD`, project.local);
    if (out) {
      result.ok = true;
      result.commit = out.split('\t')[0]?.substring(0, 8) || null;
    }
    const logOut = git('git log --oneline -20', project.local);
    result.recentCommits = logOut ? logOut.split('\n').filter(Boolean) : [];
    result.commitCount = result.recentCommits.length;
    const stats = git('git log --format="%an" -20', project.local);
    const authors = stats ? stats.split('\n').filter(Boolean) : [];
    result.uniqueAuthors = new Set(authors).size;
  } catch {}
  return result;
}

function collectLocal(project) {
  const result = { exists: fs.existsSync(project.local) };
  if (!result.exists) return result;
  try {
    const status = git('git status --short', project.local);
    result.uncommitted = status ? status.split('\n').filter(Boolean).length : 0;
    const branch = git('git branch --show-current', project.local);
    result.branch = branch || 'unknown';
    const lastCommit = git('git log -1 --format="%ci %s"', project.local);
    result.lastCommit = lastCommit || null;
    const lineCount = git('git log --oneline | wc -l', project.local);
    result.totalCommits = parseInt(lineCount) || 0;
  } catch {}
  return result;
}

function collectAFDian() {
  try {
    const stateFile = path.join(DATA_DIR, 'daemon-state.json');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      return {
        ok: true,
        sponsors: state.sponsors?.length || 0,
        lastFetch: state.lastFetch || null,
        totalFetches: state.totalFetches || 0,
      };
    }
  } catch {}
  return { ok: false, sponsors: 0 };
}

function collectAll() {
  log('=== Data Collection ===');
  const snapshot = {
    timestamp: new Date().toISOString(),
    projects: {},
    afdian: collectAFDian(),
    system: {
      uptime: Math.round(process.uptime() / 60) + 'm',
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    },
  };

  for (const project of PROJECTS) {
    snapshot.projects[project.name] = {
      local: collectLocal(project),
      github: collectGitHub(project),
    };
  }

  // Save snapshot
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let history = [];
    if (fs.existsSync(EXCHANGE_FILE)) {
      history = JSON.parse(fs.readFileSync(EXCHANGE_FILE, 'utf8'));
    }
    history.push(snapshot);
    // Keep last 100 snapshots
    if (history.length > 100) history = history.slice(-100);
    fs.writeFileSync(EXCHANGE_FILE, JSON.stringify(history, null, 2));
  } catch {}

  log(`Collected ${PROJECTS.length} projects + AFDian`);
  return snapshot;
}

// ── Trend Analysis ────────────────────────────────────────────
function analyzeTrends() {
  log('=== Trend Analysis ===');
  const insights = [];
  let history = [];
  try { history = JSON.parse(fs.readFileSync(EXCHANGE_FILE, 'utf8')); } catch {}

  if (history.length < 2) {
    log('Not enough data for trend analysis (need >= 2 snapshots)');
    return insights;
  }

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];

  // Commit velocity
  for (const [name, proj] of Object.entries(latest.projects)) {
    const prevProj = prev.projects[name];
    if (prevProj) {
      const deltaCommits = (proj.local?.totalCommits || 0) - (prevProj.local?.totalCommits || 0);
      if (deltaCommits > 0) {
        insights.push({
          type: 'growth',
          project: name,
          message: `${name}: +${deltaCommits} commits since last check`,
          confidence: 0.8,
        });
      }
      const uncommitted = proj.local?.uncommitted || 0;
      if (uncommitted > 20) {
        insights.push({
          type: 'risk',
          project: name,
          message: `${name}: ${uncommitted} uncommitted changes - risk of data loss`,
          confidence: 0.9,
        });
      }
    }
  }

  // AFDian trends
  if (latest.afdian.ok) {
    const sponsorDelta = (latest.afdian.sponsors || 0) - (prev.afdian?.sponsors || 0);
    if (sponsorDelta > 0) {
      insights.push({
        type: 'revenue',
        message: `AFDian: +${sponsorDelta} new sponsor(s) since last check`,
        confidence: 0.7,
      });
    }
  }

  // System health trend
  const memTrend = history.slice(-10).map(h => h.system?.memory?.match(/(\d+)/)?.[1] || 0).map(Number);
  if (memTrend.length >= 3) {
    const avg = memTrend.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(memTrend.slice(0, -3).length, 1);
    const recent = memTrend.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (recent > avg * 1.5) {
      insights.push({
        type: 'system',
        message: `Memory usage trending up (${Math.round(avg)}MB -> ${Math.round(recent)}MB)`,
        confidence: 0.6,
      });
    }
  }

  return insights;
}

// ── Learning & Brain Feedback ─────────────────────────────────
function feedBrain(insights, snapshot) {
  const learned = [];
  try {
    let brain = { decisions: [], learned: [], selfState: { health: 'unknown', cycles: 0 } };
    if (fs.existsSync(BRAIN_FILE)) {
      brain = JSON.parse(fs.readFileSync(BRAIN_FILE, 'utf8'));
    }
    if (!brain.decisions) brain.decisions = [];
    if (!brain.learned) brain.learned = [];

    for (const insight of insights) {
      const entry = {
        time: new Date().toISOString(),
        type: insight.type,
        project: insight.project || 'system',
        insight: insight.message,
        confidence: insight.confidence || 0.5,
      };
      brain.learned.push(entry);
      learned.push(insight.message);

      // Generate decision suggestions
      if (insight.type === 'risk' && insight.confidence > 0.7) {
        brain.decisions.push({
          time: new Date().toISOString(),
          action: 'suggest-repair',
          project: insight.project,
          detail: insight.message,
          source: 'dialogue-exchange',
        });
      }
      if (insight.type === 'revenue') {
        brain.decisions.push({
          time: new Date().toISOString(),
          action: 'monetization-update',
          detail: insight.message,
          source: 'dialogue-exchange',
        });
      }
    }

    // Trim
    if (brain.learned.length > 200) brain.learned = brain.learned.slice(-200);
    if (brain.decisions.length > 200) brain.decisions = brain.decisions.slice(-200);

    fs.writeFileSync(BRAIN_FILE, JSON.stringify(brain, null, 2));
    log(`Brain updated: ${learned.length} new insights, ${brain.decisions.length} total decisions`);
  } catch (e) {
    log('Brain feedback error: ' + e.message);
  }
  return learned;
}

// ── Full Exchange Cycle ───────────────────────────────────────
function fullExchange() {
  const snapshot = collectAll();
  const insights = analyzeTrends();
  const learned = feedBrain(insights, snapshot);

  // Save state
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      lastExchange: new Date().toISOString(),
      lastSnapshot: snapshot,
      insights,
      learnedCount: learned.length,
    }, null, 2));
  } catch {}

  log(`Exchange complete: ${insights.length} insights, ${learned.length} learned`);
  return { snapshot, insights, learned };
}

// ── Daemon ────────────────────────────────────────────────────
function start(intervalMin = 30) {
  const intervalMs = intervalMin * 60 * 1000;
  log(`Dialogue-exchange started (interval: ${intervalMin}min, PID ${process.pid})`);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}

  const tick = () => {
    try { fullExchange(); } catch (e) { log('Exchange error: ' + e.message); }
  };
  tick();
  const timer = setInterval(tick, intervalMs);

  const shutdown = () => {
    log('Dialogue-exchange stopped');
    clearInterval(timer);
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ── CLI ───────────────────────────────────────────────────────
const cmd = process.argv[2] || 'collect';
switch (cmd) {
  case 'collect': {
    const snapshot = collectAll();
    console.log(JSON.stringify(snapshot, null, 2));
    break;
  }
  case 'analyze': {
    const insights = analyzeTrends();
    console.log(`\n=== Insights (${insights.length}) ===\n`);
    for (const i of insights) {
      const icon = i.type === 'risk' ? '!' : i.type === 'growth' ? '+' : i.type === 'revenue' ? '$' : '~';
      console.log(`  ${icon} [${i.type}] ${i.message}`);
    }
    if (insights.length === 0) console.log('  No significant trends detected.');
    console.log('');
    break;
  }
  case 'exchange':
    fullExchange();
    break;
  case 'start':
    start(parseInt(process.argv[3], 10) || 30);
    break;
  case 'stop': {
    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      if (pid) { process.kill(pid, 'SIGTERM'); log('Stopped'); }
      else log('Not running');
    } catch { log('Not running'); }
    try { fs.unlinkSync(PID_FILE); } catch {}
    break;
  }
  case 'status': {
    let pid = 0, alive = false;
    try { pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10); alive = isAlive(pid); } catch {}
    let state = {};
    try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
    console.log(JSON.stringify({
      running: alive,
      pid: pid || null,
      lastExchange: state.lastExchange || null,
      lastInsights: (state.insights || []).slice(0, 5),
    }, null, 2));
    break;
  }
  case 'insights': {
    let history = [];
    try { history = JSON.parse(fs.readFileSync(EXCHANGE_FILE, 'utf8')); } catch {}
    console.log(`\n=== Data Exchange History (${history.length} snapshots) ===\n`);
    for (const h of history.slice(-5)) {
      console.log(`  [${h.timestamp}]`);
      for (const [name, p] of Object.entries(h.projects || {})) {
        console.log(`    ${name}: commits=${p.local?.totalCommits || '?'} uncommitted=${p.local?.uncommitted || '?'} branch=${p.local?.branch || '?'}`);
      }
      if (h.afdian?.ok) console.log(`    AFDian: ${h.afdian.sponsors} sponsors`);
    }
    console.log('');
    break;
  }
  default:
    console.log('Usage: node dialogue-exchange.js <collect|analyze|exchange|start|stop|status|insights> [minutes]');
}

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

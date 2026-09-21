#!/usr/bin/env node
'use strict';
/**
 * Auto-Maintain Daemon
 * 
 * Continuously monitors:
 * - Local dev directories vs GitHub/Gitee remote state
 * - AFDian sponsorship data
 * - Repo health (issues, stars, CI status)
 * - Auto-syncs changes when detected
 * 
 * CLI:
 *   node bin/auto-maintain.js start [minutes]  - Start daemon (foreground)
 *   node bin/auto-maintain.js stop             - Stop daemon
 *   node bin/auto-maintain.js status           - Show status
 *   node bin/auto-maintain.js sync             - One-shot sync
 *   node bin/auto-maintain.js report           - Full health report
 *   node bin/auto-maintain.js diff             - Show local vs remote diffs
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const STATE_FILE = path.join(DATA_DIR, 'maintain-state.json');
const LOG_FILE = path.join(DATA_DIR, 'maintain.log');
const PID_FILE = path.join(DATA_DIR, 'maintain.pid');

// Load .env file for tokens
function loadEnv(key) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp('^' + key + '=([^\\\\n]+)', 'm'));
      if (match) return match[1].trim();
    }
  } catch {}
  return '';
}

const CONFIG = {
  githubToken: process.env.GITHUB_TOKEN || loadEnv('GITHUB_TOKEN'),
  giteeToken: process.env.GITEE_TOKEN || loadEnv('GITEE_TOKEN'),
  owner: 'Zeon7744',
  // Projects to monitor: localPath -> { githubRepo, giteeRepo }
  projects: [
    {
      name: 'tri-link-test',
      local: 'D:/项目/开发部/github/tri-link-test',
      github: 'tri-link-test',
      gitee: 'tri-link-test',
      type: 'framework',
    },
    {
      name: 'proj-01',
      local: 'D:/项目/开发部/开发git/01',
      github: 'proj-01',
      gitee: 'proj-01',
      type: 'app',
    },
    {
      name: 'awesome-ai-short-drama',
      local: 'D:/项目/开发部/github/awesome-ai-short-drama',
      github: 'awesome-ai-short-drama',
      gitee: 'awesome-ai-short-drama',
      type: 'app',
    },
    {
      name: 'baibai',
      local: 'D:/项目/开发部/github/baibai',
      github: 'baibai',
      gitee: 'baibai',
      type: 'tool',
    },
    {
      name: 'crypto-mlp-high-confidence',
      local: 'D:/项目/开发部/github/crypto-mlp-high-confidence',
      github: 'crypto-mlp-high-confidence',
      gitee: 'crypto-mlp-high-confidence',
      type: 'research',
    },
    {
      name: 'global-investment-mlp',
      local: 'D:/项目/开发部/github/global-investment-mlp',
      github: 'global-investment-mlp',
      gitee: 'global-investment-mlp',
      type: 'research',
    },
    {
      name: 'dev-artifacts',
      local: 'D:/项目/开发部/github/dev-artifacts',
      github: 'dev-artifacts',
      gitee: 'dev-artifacts',
      type: 'artifact',
    },
      {
        name: 'jianzhu-agent',
        local: 'D:/项目/开发部/开发git/02/建筑行业检测及信息咨询公司agent',
        github: 'jianzhu-agent',
        gitee: 'jianzhu-agent',
        type: 'app',
      },
  ],
  intervals: {
    github: 5 * 60 * 1000,   // 5 min
    gitee: 5 * 60 * 1000,
    afdian: 30 * 60 * 1000,  // 30 min
    sync: 10 * 60 * 1000,    // 10 min
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}`;
  try { fs.appendFileSync(LOG_FILE, msg + '\n'); } catch {}
  console.log(msg);
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastCheck: null, lastSync: null, projects: {}, errors: [] }; }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function gitCommand(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

function githubAPI(path) {
  return new Promise((resolve) => {
    const req = require('https').get({
      hostname: 'api.github.com',
      path,
      headers: { 'User-Agent': 'tri-link-maintain', 'Authorization': `Bearer ${CONFIG.githubToken}` },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve({ _raw: d.substring(0, 200) }); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.on('error', (e) => { resolve(null); });
  });
}

function giteeAPI(path) {
  return new Promise((resolve) => {
    const token = CONFIG.giteeToken;
    const req = require('https').get({
      hostname: 'gitee.com',
      path: path + (path.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + token,
      headers: { 'User-Agent': 'tri-link-maintain' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve({ _raw: d.substring(0, 200) }); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.on('error', (e) => { resolve(null); });
  });
}

// ─── GitHub Status ──────────────────────────────────────────────────────────

async function checkGitHub(project) {
  try {
    const repo = await githubAPI(`/repos/${CONFIG.owner}/${project.github}`);
    if (!repo || repo.message) return { ok: false, error: repo?.message || 'not found' };
    return {
      ok: true,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      size: repo.size,
      updated: repo.updated_at,
      openIssues: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      hasWiki: repo.has_wiki,
      hasPages: repo.has_pages,
      language: repo.language,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Gitee Status ───────────────────────────────────────────────────────────

async function checkGitee(project) {
  try {
    const repo = await giteeAPI(`/api/v5/repos/${CONFIG.owner}/${project.gitee}`);
    if (!repo || repo.message) return { ok: false, error: repo?.message || 'not found' };
    return {
      ok: true,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updated: repo.updated_at,
      description: repo.description,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Local State ────────────────────────────────────────────────────────────

function getLocalState(project) {
  const local = project.local;
  if (!fs.existsSync(local)) return { exists: false };

  const result = {
    exists: true,
    isGitRepo: fs.existsSync(path.join(local, '.git')),
    branch: null,
    commitsAhead: null,
    commitsBehind: null,
    fileCount: 0,
    sizeKB: 0,
    lastCommit: null,
    hasNodeModules: false,
  };

  // Git info
  if (result.isGitRepo) {
    result.branch = gitCommand('git branch --show-current', local);
    const ahead = gitCommand('git rev-list --count HEAD..origin/main 2>/dev/null || git rev-list --count HEAD..origin/master 2>/dev/null || echo 0', local);
    const behind = gitCommand('git rev-list --count origin/main..HEAD 2>/dev/null || git rev-list --count origin/master..HEAD 2>/dev/null || echo 0', local);
    result.commitsAhead = parseInt(ahead) || 0;
    result.commitsBehind = parseInt(behind) || 0;
    const lastCommit = gitCommand('git log -1 --format=%ci', local);
    result.lastCommit = lastCommit || null;
  }

  // File stats
  try {
    let count = 0;
    let size = 0;
    let hasNM = false;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') hasNM = true;
          else walk(full);
        } else {
          count++;
          try { size += fs.statSync(full).size; } catch {}
        }
      }
    };
    walk(local);
    result.fileCount = count;
    result.sizeKB = Math.round(size / 1024);
    result.hasNodeModules = hasNM;
    try { result.hasReadme = fs.existsSync(path.join(local, 'README.md')); } catch { result.hasReadme = false; }
    try { result.hasPackageJson = fs.existsSync(path.join(local, 'package.json')) || fs.existsSync(path.join(local, 'src', 'frontend', 'package.json')); } catch { result.hasPackageJson = false; }
  } catch {}

  return result;
}

// ─── AFDian ─────────────────────────────────────────────────────────────────

async function checkAfdian() {
  try {
    const fs2 = require('fs');
    const crypto = require('crypto');
    const cfgPath = path.join(HOME, '.local', 'bin', 'afdian-link-config.json');
    if (!fs2.existsSync(cfgPath)) return { ok: false, error: 'no config' };
    const cfg = JSON.parse(fs2.readFileSync(cfgPath, 'utf8'));
    const paramsJson = JSON.stringify({ page: 1 });
    const ts = Math.floor(Date.now() / 1000);
    const raw = cfg.token + 'params' + paramsJson + 'ts' + ts + 'user_id' + cfg.user_id;
    const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
    const body = JSON.stringify({ user_id: cfg.user_id, params: paramsJson, ts, sign });
    return new Promise((resolve) => {
      const req = require('https').request({
        hostname: 'afdian.com',
        path: '/api/open/query-sponsor',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'tri-link-maintain/1.0' },
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const r = JSON.parse(d);
            resolve({ ok: r.ec === 200, sponsors: r.data?.total_count || 0, listLen: r.data?.list?.length || 0 });
          } catch { resolve({ ok: false, error: d.substring(0, 100) }); }
        });
      });
      req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      req.write(body);
      req.end();
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Diff Check ─────────────────────────────────────────────────────────────

async function checkDiff(project) {
  const local = getLocalState(project);
  if (!local.exists || !local.isGitRepo) return { needsSync: false, reason: 'no git repo' };

  const gh = await checkGitHub(project);
  if (!gh.ok) return { needsSync: false, reason: 'github unavailable' };

  const needsSync = local.commitsAhead > 0 || local.commitsBehind > 0;
  return {
    needsSync,
    localBranch: local.branch,
    githubBranch: gh.defaultBranch,
    commitsAhead: local.commitsAhead,
    commitsBehind: local.commitsBehind,
    lastLocalCommit: local.lastCommit,
    lastGitHubUpdate: gh.updated,
    sizeDelta: Math.abs(local.sizeKB - gh.size),
  };
}

// ─── Auto Sync ──────────────────────────────────────────────────────────────

async function autoSync(project) {
  const local = project.local;
  if (!fs.existsSync(local)) return { ok: false, error: 'local path not found' };

  try {
    // Stage all changes
    gitCommand('git add -A', local);
    // Check if there are changes
    const status = gitCommand('git status --short', local);
    if (!status || status.trim() === '') return { ok: true, synced: false, reason: 'no changes' };

    // Commit
    const commitMsg = `chore(auto): sync ${project.name} - ${new Date().toISOString().substring(0, 10)}`;
    gitCommand(`git commit -m "${commitMsg}"`, local);

    // Push to GitHub
    const ghResult = gitCommand('git push origin main 2>&1', local) || gitCommand('git push origin master 2>&1', local);
    const ghOk = ghResult && !ghResult.includes('error');

    // Push to Gitee
    const geResult = gitCommand('git push gitee main 2>&1', local) || gitCommand('git push gitee master 2>&1', local);
    const geOk = geResult && !geResult.includes('error');

    return {
      ok: true,
      synced: true,
      github: ghOk ? 'pushed' : 'failed',
      gitee: geOk ? 'pushed' : 'failed',
      commitMsg,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Main Loop ──────────────────────────────────────────────────────────────

let maintainRunning = false;
let maintainTimer = null;

async function runCheck() {
  log('=== Auto-Maintain Check ===');
  const state = readState();
  state.lastCheck = new Date().toISOString();
  // Self-heal: check daemon health
  await selfHeal();

  for (const project of CONFIG.projects) {
    try {
      const diff = await checkDiff(project);
      const local = getLocalState(project);
      const gh = await checkGitHub(project);
      const ge = await checkGitee(project);

      log(`[${project.name}] local=${local.exists ? 'ok' : 'missing'} github=${gh.ok ? '★' + gh.stars : 'err'} gitee=${ge.ok ? 'ok' : 'err'} sync=${diff.needsSync ? 'NEEDS' : 'ok'}`);

      if (!state.projects[project.name]) state.projects[project.name] = {};
      state.projects[project.name].lastCheck = new Date().toISOString();
      state.projects[project.name].githubStars = gh.ok ? gh.stars : null;
      state.projects[project.name].githubSize = gh.ok ? gh.size : null;
      state.projects[project.name].localSize = local.sizeKB;
      state.projects[project.name].localFiles = local.fileCount;
      state.projects[project.name].commitsAhead = local.commitsAhead;
      state.projects[project.name].hasNodeModules = local.hasNodeModules;
      const pubScore = computePublishScore(local, gh, ge);
      state.projects[project.name].publishScore = pubScore.score;
      state.projects[project.name].publishLevel = pubScore.level;
      state.projects[project.name].publishChecks = pubScore.checks;

      // Auto-sync if needed
      if (diff.needsSync && diff.commitsAhead > 0) {
        log(`  → Auto-syncing ${project.name} (${diff.commitsAhead} commits ahead)`);
        const syncResult = await autoSync(project);
        log(`  → ${syncResult.ok ? syncResult.synced ? 'synced' : 'no changes' : 'failed: ' + syncResult.error}`);
        if (!syncResult.ok) {
          state.errors.push({ time: new Date().toISOString(), project: project.name, error: syncResult.error });
          if (state.errors.length > 20) state.errors.shift();
        }
      }
    } catch (e) {
      log(`  [${project.name}] error: ${e.message}`);
    }
  }

  // Check AFDian
  try {
    const afd = await checkAfdian();
    state.afdianLastCheck = new Date().toISOString();
    state.afdianSponsors = afd.ok ? afd.sponsors : null;
    log(`AFDian: ${afd.ok ? afd.sponsors + ' sponsors' : 'error: ' + afd.error}`);
  } catch (e) {
    log(`AFDian error: ${e.message}`);
  }

  writeState(state);
  log('Check complete.');
}

function writePid() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function readPid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10); } catch { return null; }
}

function runDaemon(intervalMs) {
  if (maintainRunning) {
    console.log('Daemon already running (PID:', readPid(), ')');
    process.exit(1);
  }
  maintainRunning = true;
  writePid();
  log(`Auto-maintain daemon started (interval: ${Math.round(intervalMs / 60000)}min)`);
  console.log(`Auto-Maintain Daemon started (PID=${process.pid}, interval=${Math.round(intervalMs / 60000)}min)`);

  const tick = async () => {
    try { await runCheck(); }
    catch (err) { log('Tick error: ' + err.message); }
  };

  tick();
  maintainTimer = setInterval(tick, intervalMs);

  const shutdown = async () => {
    log('Daemon shutting down...');
    console.log('\nDaemon shutting down...');
    if (maintainTimer) clearInterval(maintainTimer);
    maintainRunning = false;
    try { fs.unlinkSync(PID_FILE); } catch {}
    writeState(readState());
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];
const interval = parseInt(args[1], 10) || 10;

if (!cmd) {
  console.log(`
Auto-Maintain Daemon v1.0
Monitors local dev dirs vs GitHub/Gitee/AFDian and auto-syncs changes.

Usage:
  node bin/auto-maintain.js start [minutes]   - Start daemon (foreground, Ctrl+C to stop)
  node bin/auto-maintain.js stop              - Stop daemon
  node bin/auto-maintain.js status            - Show current status
  node bin/auto-maintain.js sync              - One-shot sync all projects
  node bin/auto-maintain.js report            - Full health report
  node bin/auto-maintain.js diff              - Show local vs remote diffs
  node bin/auto-maintain.js logs              - Show recent logs
`);
  process.exit(0);
}

// Self-healing: restart AFDian daemon if dead
async function selfHeal() {
  try {
    const AFDIAN_PID_FILE = path.join(DATA_DIR, 'daemon.pid');
    let afdianPid = 0;
    try { afdianPid = parseInt(fs.readFileSync(AFDIAN_PID_FILE, 'utf8').trim(), 10); } catch {}
    let alive = false;
    if (afdianPid) { try { process.kill(afdianPid, 0); alive = true; } catch {} }
    if (!alive) {
      log('AFDian daemon dead, restarting...');
      const afdianScript = path.join(__dirname, 'afdian-daemon.js');
      const proc = spawn(process.execPath, [afdianScript, 'start', '30'], {
        cwd: path.join(__dirname, '..'),
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
      await new Promise(r => setTimeout(r, 3000));
      try { fs.writeFileSync(AFDIAN_PID_FILE, String(proc.pid)); } catch {}
      log('AFDian daemon restarted (PID ' + proc.pid + ')');
    }
  } catch (e) { log('selfHeal error: ' + e.message); }
}

// Publish Readiness Score
function computePublishScore(local, gh, ge) {
  let score = 0;
  const checks = [];
  if (local.exists && local.hasReadme) { score += 20; checks.push('README'); } else { checks.push('no-README'); }
  if (gh.ok) { score += 15; checks.push('GitHub'); } else { checks.push('no-GitHub'); }
  if (ge.ok) { score += 10; checks.push('Gitee'); } else { checks.push('no-Gitee'); }
  if (local.exists && !local.hasNodeModules) { score += 15; checks.push('clean'); } else { checks.push('nm'); }
  if (local.exists && local.commitsAhead === 0) { score += 15; checks.push('synced'); } else { checks.push('unpushed'); }
  if (local.sizeKB < 50000) { score += 5; } else { checks.push('large'); }
  if (gh.ok && gh.stars > 0) { score += Math.min(gh.stars * 2, 10); }
  if (local.exists && local.hasPackageJson) { score += 10; checks.push('pkg'); } else { checks.push('no-pkg'); }
  const level = score >= 80 ? 'publish-ready' : score >= 50 ? 'needs-work' : 'draft';
  return { score: Math.min(score, 100), level, checks };
}

(async () => {
  switch (cmd) {
    case 'start':
      const pid = readPid();
      if (pid && pid !== process.pid) {
        try { process.kill(pid, 0); console.log(`Already running (PID ${pid}). Use 'stop' first.`); process.exit(1); }
        catch { /* stale PID */ }
      }
      runDaemon(interval * 60 * 1000);
      break;

    case 'stop':
      const stopPid = readPid();
      if (stopPid) {
        const killed = (() => { try { process.kill(stopPid, 'SIGTERM'); return true; } catch { return false; } })();
        try { fs.unlinkSync(PID_FILE); } catch {}
        console.log(killed ? `Stopped (PID ${stopPid})` : 'Not running');
      } else {
        console.log('No daemon running');
      }
      break;

    case 'status': {
      const state = readState();
      const pid = readPid();
      console.log(JSON.stringify({
        running: !!pid,
        pid,
        lastCheck: state.lastCheck,
        lastSync: state.lastSync,
        projects: Object.entries(state.projects || {}).map(([k, v]) => ({
          name: k,
          githubStars: v.githubStars,
          localSize: v.localSize,
          commitsAhead: v.commitsAhead,
          hasNodeModules: v.hasNodeModules,
        })),
        afdianSponsors: state.afdianSponsors,
        errorCount: (state.errors || []).length,
      }, null, 2));
      break;
    }

    case 'sync':
      console.log('Running one-shot sync...');
      await runCheck();
      console.log('Sync complete.');
      break;

    case 'report': {
      const state = readState();
      console.log('\n=== Auto-Maintain Report ===\n');
      console.log(`Last check: ${state.lastCheck || 'never'}`);
      console.log(`Last sync: ${state.lastSync || 'never'}`);
      console.log(`AFDian sponsors: ${state.afdianSponsors ?? 'unknown'}`);
      console.log(`Errors: ${(state.errors || []).length}`);
      console.log('\nProjects:');
      for (const [name, v] of Object.entries(state.projects || {})) {
        const syncNeeded = v.commitsAhead > 0;
        console.log(`  ${name}: stars=${v.githubStars} local=${v.localSize}KB files=${v.localFiles} ${syncNeeded ? '⚠ NEEDS SYNC' : '✓ in sync'}`);
      }
      console.log('');
      break;
    }

    case 'diff': {
      console.log('\n=== Local vs Remote Diff ===\n');
      for (const project of CONFIG.projects) {
        const local = getLocalState(project);
        const gh = await checkGitHub(project);
        const ge = await checkGitee(project);
        console.log(`[${project.name}]`);
        console.log(`  Local: ${local.exists ? 'exists' : 'MISSING'} ${local.isGitRepo ? 'git:'+local.branch : 'no-git'}`);
        if (local.exists) {
          console.log(`  Files: ${local.fileCount} | Size: ${local.sizeKB}KB | NM: ${local.hasNodeModules}`);
          console.log(`  Ahead: ${local.commitsAhead} | Behind: ${local.commitsBehind}`);
        }
        console.log(`  GitHub: ${gh.ok ? '★'+gh.stars+' '+gh.size+'KB' : 'ERR'}`);
        console.log(`  Gitee: ${ge.ok ? '★'+ge.stars : 'ERR'}`);
        console.log('');
      }
      break;
    }

    case 'logs': {
      try {
        const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
        console.log(lines.slice(-30).join('\n'));
      } catch { console.log('No log file yet.'); }
      break;
    }

    default:
      console.log(`Unknown command: ${cmd}`);
      process.exit(1);
  }
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
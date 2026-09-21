#!/usr/bin/env node
'use strict';
/**
 * Agent Ops - Autonomous Digital Employee
 * 
 * Self-aware maintenance agent that:
 * - Monitors all projects (local + GitHub + Gitee + AFDian)
 * - Analyzes publish readiness and security risks
 * - Auto-repairs issues (dead daemons, unsynced code, missing repos)
 * - Generates improvement recommendations
 * - Runs self-healing on every cycle
 * 
 * CLI:
 *   node bin/agent-ops.js run         - Single autonomous cycle
 *   node bin/agent-ops.js start [min] - Daemon mode
 *   node bin/agent-ops.js stop        - Stop daemon
 *   node bin/agent-ops.js status      - Show status
 *   node bin/agent-ops.js report      - Full analysis report
 *   node bin/agent-ops.js score       - Publish readiness scores
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const STATE_FILE = path.join(DATA_DIR, 'agent-ops-state.json');
const LOG_FILE = path.join(DATA_DIR, 'agent-ops.log');
const PID_FILE = path.join(DATA_DIR, 'agent-ops.pid');
const BRAIN_FILE = path.join(DATA_DIR, 'brain.json');

const CONFIG = {
  githubToken: process.env.GITHUB_TOKEN || '[REDACTED_GITHUB_TOKEN]',
  giteeToken: process.env.GITEE_TOKEN || '[REDACTED_GITEE_TOKEN]',
  owner: 'Zeon7744',
  projects: [
    { name: 'tri-link-test', local: 'D:/项目/开发部/github/tri-link-test', github: 'tri-link-test', gitee: 'tri-link-test', type: 'framework' },
    { name: 'proj-01', local: 'D:/项目/开发部/开发git/01', github: 'proj-01', gitee: 'proj-01', type: 'app' },
    { name: 'jianzhu-agent', local: 'D:/项目/开发部/开发git/02/建筑行业检测及信息咨询公司agent', github: 'jianzhu-agent', gitee: 'jianzhu-agent', type: 'app' },
    { name: 'awesome-ai-short-drama', local: 'D:/项目/开发部/github/awesome-ai-short-drama', github: 'awesome-ai-short-drama', gitee: 'awesome-ai-short-drama', type: 'app' },
    { name: 'baibai', local: 'D:/项目/开发部/github/baibai', github: 'baibai', gitee: 'baibai', type: 'tool' },
    { name: 'crypto-mlp-high-confidence', local: 'D:/项目/开发部/github/crypto-mlp-high-confidence', github: 'crypto-mlp-high-confidence', gitee: 'crypto-mlp-high-confidence', type: 'research' },
    { name: 'global-investment-mlp', local: 'D:/项目/开发部/github/global-investment-mlp', github: 'global-investment-mlp', gitee: 'global-investment-mlp', type: 'research' },
    { name: 'dev-artifacts', local: 'D:/项目/开发部/github/dev-artifacts', github: 'dev-artifacts', gitee: 'dev-artifacts', type: 'artifact' },
  ],
  intervalMin: 15,
};

// === Utilities ===
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

function git(cmd, cwd) {
  try {
    const isWin = process.platform === 'win32';
    let result;
    if (isWin) {
      // On Windows, replace Unix patterns
      let winCmd = cmd
        .replace(/2>\\\\$null/g, '2>`NUL')
        .replace(/ \\| head -1/g, '')
        .replace(/ \\| head -\\d+/g, '');
      result = execSync(winCmd, { cwd, encoding: 'utf8', timeout: 30000 }).trim();
    } else {
      result = execSync(cmd, { cwd, encoding: 'utf8', timeout: 30000 }).trim();
    }
    return result;
  }
  catch { return null; }
}

// === Memory/Brain ===
function loadBrain() {
  try { return JSON.parse(fs.readFileSync(BRAIN_FILE, 'utf8')); }
  catch { return { decisions: [], learned: [], patterns: [], selfState: { health: 'unknown', cycles: 0 } }; }
}

function saveBrain(brain) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BRAIN_FILE, JSON.stringify(brain, null, 2));
  } catch {}
}

// === Self-Awareness ===
function selfState() {
  const state = {
    timestamp: new Date().toISOString(),
    projectsTracked: CONFIG.projects.length,
    daemons: {},
    memory: { decisions: 0, learned: 0 },
    health: 'healthy',
    warnings: [],
  };
  // Check daemon PIDs
  for (const [name, pidFile] of [['auto-maintain', 'maintain.pid'], ['afdian', 'daemon.pid']]) {
    try {
      const pid = parseInt(fs.readFileSync(path.join(DATA_DIR, pidFile), 'utf8').trim(), 10);
      let alive = false;
      if (pid) { try { process.kill(pid, 0); alive = true; } catch {} }
      state.daemons[name] = { pid, alive };
      if (!alive) { state.warnings.push(`${name} daemon dead`); state.health = 'degraded'; }
    } catch {
      state.daemons[name] = { pid: null, alive: false };
      state.warnings.push(`${name} daemon missing`);
      state.health = 'critical';
    }
  }
  const brain = loadBrain();
  state.memory = { decisions: (brain.decisions || []).length, learned: (brain.learned || []).length };
  return state;
}

// === Risk Analysis ===
function analyzeRisks(project) {
  const risks = [];
  const local = project.local;
  
  // 1. Check for hardcoded secrets
  const secretPatterns = [
    /ghp_[a-zA-Z0-9]{36}/g,
    /ghs_[a-zA-Z0-9]{36}/g,
    /access_token=[a-f0-9]{32}/g,
    /Bearer\s+[a-f0-9]{32}/g,
  ];
  
  if (fs.existsSync(local)) {
    const exts = ['.js', '.json', '.py', '.html', '.md', '.yml', '.yaml', '.env'];
    const files = walkFiles(local, 3);
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (!exts.includes(ext)) continue;
      if (f.includes('node_modules')) continue;
      try {
        const content = fs.readFileSync(f, 'utf8');
        for (const pat of secretPatterns) {
          pat.lastIndex = 0;
          const matches = content.match(pat);
          if (matches) {
            const rel = path.relative(local, f);
            risks.push({ severity: 'high', category: 'security', file: rel, issue: `Hardcoded secret: ${matches[0].substring(0, 8)}...`, fix: 'Move to .env and add to .gitignore' });
          }
        }
        // Check for .env files committed
        if (f.endsWith('.env') && !f.endsWith('.env.example')) {
          risks.push({ severity: 'high', category: 'security', file: path.relative(local, f), issue: '.env file tracked in git', fix: 'Add to .gitignore and rotate tokens' });
        }
      } catch {}
    }
  }
  
  // 2. Check for missing .gitignore
  if (fs.existsSync(local) && fs.existsSync(path.join(local, '.git')) && !fs.existsSync(path.join(local, '.gitignore'))) {
    risks.push({ severity: 'medium', category: 'config', file: '.gitignore', issue: 'Missing .gitignore', fix: 'Create .gitignore with node_modules, .env, __pycache__' });
  }
  
  // 3. Check for node_modules in git tracking
  const trackedNM = git('git ls-files -- "*node_modules*" 2>nul | more +0', local);
  if (trackedNM) {
    risks.push({ severity: 'high', category: 'bloat', file: 'node_modules/', issue: 'node_modules tracked in git', fix: 'Remove with git rm -r --cached node_modules && add to .gitignore' });
  }
  
  // 4. Check package.json completeness
  const pkgPaths = ['package.json', 'src/frontend/package.json'];
  let pkgFound = false;
  for (const p of pkgPaths) {
    const pkgPath = path.join(local, p);
    if (fs.existsSync(pkgPath)) {
      pkgFound = true;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (!pkg.name) risks.push({ severity: 'low', category: 'quality', file: p, issue: 'package.json missing name field', fix: 'Add name field' });
        if (!pkg.version) risks.push({ severity: 'low', category: 'quality', file: p, issue: 'package.json missing version field', fix: 'Add version field' });
        if (!pkg.description) risks.push({ severity: 'low', category: 'quality', file: p, issue: 'package.json missing description', fix: 'Add description' });
        if (!pkg.scripts || Object.keys(pkg.scripts).length === 0) risks.push({ severity: 'low', category: 'quality', file: p, issue: 'No npm scripts defined', fix: 'Add at least build/start scripts' });
      } catch {}
      break;
    }
  }
  
  // 5. Check README quality
  const readmePath = path.join(local, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    if (readme.length < 200) risks.push({ severity: 'medium', category: 'docs', file: 'README.md', issue: 'README too short (<200 chars)', fix: 'Expand with install/usage instructions' });
    if (!readme.includes('## ') && readme.length > 100) risks.push({ severity: 'low', category: 'docs', file: 'README.md', issue: 'No section headers in README', fix: 'Add ## sections for structure' });
  } else {
    risks.push({ severity: 'high', category: 'docs', file: 'README.md', issue: 'Missing README', fix: 'Create README with project description' });
  }
  
  // 6. Check for test files
  const testFiles = walkFiles(local, 4).filter(f => /test|spec/i.test(f) && !f.includes('node_modules'));
  if (testFiles.length === 0 && fs.existsSync(path.join(local, 'src'))) {
    risks.push({ severity: 'low', category: 'quality', file: '', issue: 'No test files found', fix: 'Add at least basic smoke tests' });
  }
  
  // 7. Check for large files (>1MB)
  const largeFiles = walkFiles(local, 4).filter(f => !f.includes('node_modules') && !f.includes('.git'));
  for (const f of largeFiles) {
    try {
      const stat = fs.statSync(f);
      if (stat.size > 5 * 1024 * 1024) {
        risks.push({ severity: 'medium', category: 'bloat', file: path.relative(local, f), issue: `Large file (${Math.round(stat.size / 1024)}KB)`, fix: 'Consider Git LFS or move to external storage' });
      }
    } catch {}
  }
  
  // 8. Check git status (uncommitted changes)
  const status = git('git status --short', local);
  if (status && status.trim() !== '') {
    const changes = status.split('\n').filter(Boolean).length;
    risks.push({ severity: 'medium', category: 'sync', file: '', issue: `${changes} uncommitted changes`, fix: 'Commit and push' });
  }
  
  return risks;
}

function walkFiles(dir, depth, maxDepth = 5) {
  const results = [];
  if (depth > (maxDepth || 5)) return results;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkFiles(full, depth + 1, maxDepth));
      else results.push(full);
    }
  } catch {}
  return results;
}

// === Comprehensive Scoring ===
function comprehensiveScore(project, risks, localState, ghState, geState) {
  let score = 100;
  const deductions = [];
  
  // Security (max -30)
  const securityRisks = risks.filter(r => r.category === 'security');
  for (const r of securityRisks) {
    const ded = r.severity === 'high' ? 15 : 5;
    score -= ded;
    deductions.push({ reason: r.issue, points: -ded });
  }
  
  // Sync (max -20)
  if (localState.exists && localState.commitsAhead > 0) {
    score -= Math.min(localState.commitsAhead * 5, 20);
    deductions.push({ reason: `${localState.commitsAhead} unpushed commits`, points: -Math.min(localState.commitsAhead * 5, 20) });
  }
  
  // Quality (max -15)
  const qualityRisks = risks.filter(r => r.category === 'quality');
  for (const r of qualityRisks) {
    score -= 3;
    deductions.push({ reason: r.issue, points: -3 });
  }
  
  // Docs (max -10)
  const docRisks = risks.filter(r => r.category === 'docs');
  for (const r of docRisks) {
    score -= r.severity === 'high' ? 8 : 3;
    deductions.push({ reason: r.issue, points: -(r.severity === 'high' ? 8 : 3) });
  }
  
  // Platform presence (max -15)
  if (!ghState.ok) { score -= 10; deductions.push({ reason: 'No GitHub repo', points: -10 }); }
  if (!geState.ok) { score -= 5; deductions.push({ reason: 'No Gitee repo', points: -5 }); }
  
  // Stars bonus
  if (ghState.ok && ghState.stars > 0) {
    const bonus = Math.min(ghState.stars * 2, 10);
    score += bonus;
    deductions.push({ reason: `GitHub ${ghState.stars} stars bonus`, points: bonus });
  }
  
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const publishable = score >= 75;
  
  return {
    score,
    grade,
    publishable,
    recommendations: deductions.filter(d => d.points < 0).map(d => d.reason),
    topFixes: deductions.filter(d => d.points < -4).map(d => d.reason).slice(0, 3),
  };
}

// === Auto-Repair ===
function autoRepair(project, risks) {
  const repairs = [];
  const local = project.local;
  
  // Fix missing .gitignore
  const gitignoreRisk = risks.find(r => r.category === 'config' && r.file === '.gitignore');
  if (gitignoreRisk && fs.existsSync(local)) {
    const gitignoreContent = [
      '# Dependencies',
      'node_modules/',
      '# Python',
      '__pycache__/',
      '*.pyc',
      '.venv/',
      '# Environment',
      '.env',
      '.env.local',
      '# Logs',
      '*.log',
      'logs/',
      '# OS',
      '.DS_Store',
      'Thumbs.db',
      '# Build',
      'dist/',
      'build/',
      '',
    ].join('\n');
    try {
      fs.writeFileSync(path.join(local, '.gitignore'), gitignoreContent);
      git('git add .gitignore', local);
      git(`git commit -m "fix: add .gitignore"`, local);
      repairs.push('Added .gitignore');
    } catch (e) {
      repairs.push(`.gitignore fix failed: ${e.message}`);
    }
  }
  
  // Fix uncommitted changes
  const status = git('git status --short', local);
  if (status && status.trim() !== '') {
    try {
      git('git add -A', local);
      git(`git commit -m "chore(agent): auto-repair sync ${new Date().toISOString().substring(0,10)}"`, local);
      const pushResult = git('git push origin main 2>&1 || git push origin master 2>&1', local);
      if (pushResult) {
        git('git push gitee main 2>&1 || git push gitee master 2>&1', local);
        repairs.push(`Synced ${status.split('\n').filter(Boolean).length} changes to GitHub+Gitee`);
      }
    } catch (e) {
      repairs.push(`Sync repair failed: ${e.message}`);
    }
  }
  
  return repairs;
}

// === Main Cycle ===
async function runCycle() {
  log('=== Agent Ops Cycle ===');
  const brain = loadBrain();
  brain.selfState = selfState();
  
  // Ensure daemons are alive
  if (brain.selfState.daemons['auto-maintain'] && !brain.selfState.daemons['auto-maintain'].alive) {
    log('→ Restarting auto-maintain daemon...');
    try {
      const proc = spawn(process.execPath, ['bin/auto-maintain.js', 'start', '10'], {
        cwd: path.join(__dirname, '..'),
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
      await new Promise(r => setTimeout(r, 2000));
      log(`→ auto-maintain restarted (PID ${proc.pid})`);
      brain.decisions.push({ time: new Date().toISOString(), action: 'restart-auto-maintain', reason: 'daemon was dead' });
    } catch {}
  }
  
  if (brain.selfState.daemons['afdian'] && !brain.selfState.daemons['afdian'].alive) {
    log('→ Restarting AFDian daemon...');
    try {
      const proc = spawn(process.execPath, [path.join(__dirname, 'afdian-daemon.js'), 'start', '30'], {
        cwd: path.join(__dirname, '..'),
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
      await new Promise(r => setTimeout(r, 2000));
      log(`→ AFDian restarted (PID ${proc.pid})`);
      brain.decisions.push({ time: new Date().toISOString(), action: 'restart-afdian', reason: 'daemon was dead' });
    } catch {}
  }
  
  // Analyze all projects
  const results = {};
  for (const project of CONFIG.projects) {
    try {
      const risks = analyzeRisks(project);
      
      // Get local state
      let localState = { exists: false, commitsAhead: 0, hasNodeModules: false, hasReadme: false, hasPackageJson: false, sizeKB: 0, fileCount: 0 };
      if (fs.existsSync(project.local)) {
        localState.exists = true;
        localState.hasReadme = fs.existsSync(path.join(project.local, 'README.md'));
        localState.hasPackageJson = fs.existsSync(path.join(project.local, 'package.json')) || fs.existsSync(path.join(project.local, 'src', 'frontend', 'package.json'));
        const ahead = git('git rev-list --count HEAD..origin/main 2>$null || git rev-list --count HEAD..origin/master 2>$null || echo 0', project.local);
        localState.commitsAhead = parseInt(ahead) || 0;
      }
      
      // Get GitHub/Gitee state (simplified - use API)
      let ghState = { ok: false, stars: 0, size: 0 };
      let geState = { ok: false, stars: 0, size: 0 };
      try {
        const ghResult = git('git ls-remote origin main 2>$null | head -1', project.local);
        ghState.ok = !!ghResult;
      } catch {}
      try {
        const geResult = git('git ls-remote gitee main 2>$null | head -1', project.local);
        geState.ok = !!geResult;
      } catch {}
      
      const score = comprehensiveScore(project, risks, localState, ghState, geState);
      
      // Auto-repair if needed
      const repairs = score.score < 70 ? autoRepair(project, risks) : [];
      
      results[project.name] = {
        risks: risks.slice(0, 5),
        score,
        repairs,
        localExists: localState.exists,
        synced: localState.commitsAhead === 0,
      };
      
      const riskCount = risks.length;
      const repairCount = repairs.length;
      log(`[${project.name}] score=${score.score} grade=${score.grade} risks=${riskCount} repairs=${repairCount} publishable=${score.publishable}`);
      
      // Learn from results
      if (riskCount > 3) {
        brain.learned.push({ time: new Date().toISOString(), project: project.name, insight: `High risk count (${riskCount}) - consider focused cleanup cycle` });
      }
      if (repairs.length > 0) {
        brain.decisions.push({ time: new Date().toISOString(), action: 'auto-repair', project: project.name, repairs });
      }
    } catch (e) {
      log(`[${project.name}] error: ${e.message}`);
    }
  }
  
  // Save state
  brain.selfState.cycles = (brain.selfState.cycles || 0) + 1;
  brain.selfState.lastCycle = new Date().toISOString();
  brain.analysisResults = results;
  saveBrain(brain);
  
  log(`Cycle complete. Decisions: ${brain.decisions.length} | Learned: ${brain.learned.length}`);
  return results;
}

// === Daemon Mode ===
let agentTimer = null;
let agentRunning = false;

function writePid() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {}
}

function readPid() {
  try { return fs.readFileSync(PID_FILE, 'utf8').trim(); } catch { return null; }
}

function runAgentDaemon(intervalMs) {
  if (agentRunning) { console.log('Agent already running'); process.exit(1); }
  agentRunning = true;
  writePid();
  log(`Agent-ops daemon started (PID=${process.pid}, interval=${Math.round(intervalMs / 60000)}min)`);
  
  const tick = async () => {
    try { await runCycle(); }
    catch (err) { log('Agent cycle error: ' + err.message); }
  };
  
  tick();
  agentTimer = setInterval(tick, intervalMs);
  
  const shutdown = () => {
    log('Agent-ops shutting down...');
    if (agentTimer) clearInterval(agentTimer);
    agentRunning = false;
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// === CLI ===
const cmd = process.argv[2] || 'run';
const intervalMin = parseInt(process.argv[3]) || CONFIG.intervalMin;

switch (cmd) {
  case 'run':
    runCycle().then(r => {
      console.log('\n=== Summary ===');
      for (const [name, data] of Object.entries(r)) {
        console.log(`  ${name}: ${data.score.grade} (${data.score.score}/100) ${data.score.publishable ? '✓' : '⚠'} ${data.repairs.length ? `repairs: ${data.repairs.join('; ')}` : ''}`);
      }
      process.exit(0);
    });
    break;
  case 'start':
    const pid = readPid();
    if (pid && pid !== String(process.pid)) {
      try { process.kill(pid, 0); console.log(`Already running (PID ${pid})`); process.exit(1); }
      catch {}
    }
    runAgentDaemon(intervalMin * 60 * 1000);
    break;
  case 'stop': {
    const pid = readPid();
    if (pid) {
      try { process.kill(pid, 'SIGTERM'); console.log(`Stopped (PID ${pid})`); }
      catch { console.log('Not running'); }
      try { fs.unlinkSync(PID_FILE); } catch {}
    } else {
      console.log('Not running');
    }
    break;
  }
  case 'status': {
    const pid = readPid();
    let alive = false;
    if (pid) { try { process.kill(pid, 0); alive = true; } catch {} }
    const brain = loadBrain();
    console.log(JSON.stringify({
      running: alive,
      pid,
      lastCycle: brain.selfState?.lastCycle,
      cycles: brain.selfState?.cycles,
      decisions: (brain.decisions || []).length,
      learned: (brain.learned || []).length,
    }, null, 2));
    break;
  }
  case 'report': {
    const brain = loadBrain();
    console.log('\n=== Agent-ops Full Report ===');
    console.log(`Cycles completed: ${brain.selfState?.cycles || 0}`);
    console.log(`Last cycle: ${brain.selfState?.lastCycle || 'never'}`);
    console.log(`Decisions made: ${(brain.decisions || []).length}`);
    console.log(`Insights learned: ${(brain.learned || []).length}`);
    if (brain.analysisResults) {
      console.log('\nProject Scores:');
      for (const [name, data] of Object.entries(brain.analysisResults)) {
        console.log(`  ${name}: ${data.score.grade} (${data.score.score}/100) publishable=${data.score.publishable}`);
        if (data.risks.length > 0) {
          data.risks.slice(0, 3).forEach(r => console.log(`    [${r.severity}] ${r.issue}`));
        }
        if (data.repairs.length > 0) {
          data.repairs.forEach(r => console.log(`    → repaired: ${r}`));
        }
      }
    }
    break;
  }
  case 'score': {
    for (const project of CONFIG.projects) {
      const risks = analyzeRisks(project);
      let localState = { exists: fs.existsSync(project.local), commitsAhead: 0, hasNodeModules: false, hasReadme: false, hasPackageJson: false, sizeKB: 0, fileCount: 0 };
      if (localState.exists) {
        const ahead = git('git rev-list --count HEAD..origin/main 2>$null || git rev-list --count HEAD..origin/master 2>$null || echo 0', project.local);
        localState.commitsAhead = parseInt(ahead) || 0;
        localState.hasReadme = fs.existsSync(path.join(project.local, 'README.md'));
        localState.hasPackageJson = fs.existsSync(path.join(project.local, 'package.json'));
      }
      const ghState = { ok: !!git('git ls-remote origin main 2>$null | head -1', project.local), stars: 0, size: 0 };
      const geState = { ok: !!git('git ls-remote gitee main 2>$null | head -1', project.local), stars: 0, size: 0 };
      const score = comprehensiveScore(project, risks, localState, ghState, geState);
      console.log(`${project.name}: ${score.grade} (${score.score}/100) publishable=${score.publishable}`);
      if (score.recommendations.length > 0) {
        console.log(`  Fixes needed: ${score.recommendations.slice(0, 3).join('; ')}`);
      }
    }
    break;
  }
  default:
    console.log(`Unknown command: ${cmd}`);
    process.exit(1);
}
'use strict';
/**
 * Quality Inspector - Deep inspection: lint, dependency audit, security scan, test coverage
 *
 * CLI:
 *   node quality-inspector.js inspect [project]  - Inspect one or all projects
 *   node quality-inspector.js report             - Latest inspection report
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'quality.log');
const STATE_FILE = path.join(DATA_DIR, 'quality-state.json');

// Load projects from auto-maintain.js
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

function walkFiles(dir, depth, maxDepth) {
  const r = [];
  if (depth > maxDepth) return r;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) r.push(...walkFiles(f, depth + 1, maxDepth));
      else r.push(f);
    }
  } catch {}
  return r;
}

// ── Security scan ─────────────────────────────────────────────
function securityScan(localPath) {
  const findings = [];
  const secretPatterns = [
    { re: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub PAT' },
    { re: /ghs_[a-zA-Z0-9]{36}/g, label: 'GitHub App token' },
    { re: /access_token=[a-f0-9]{32}/g, label: 'Gitee access token' },
    { re: /(?:api[_-]?key|apikey|secret|token)\s*[=:]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi, label: 'API key/secret' },
    { re: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/g, label: 'Private key' },
    { re: /AKIA[0-9A-Z]{16}/g, label: 'AWS access key' },
  ];

  const files = walkFiles(localPath, 0, 4).filter(f =>
    /\.(js|ts|py|json|yml|yaml|env|cfg|ini|sh|ps1)$/.test(f) && !f.includes('node_modules')
  );

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      for (const { re, label } of secretPatterns) {
        re.lastIndex = 0;
        if (re.test(content)) {
          findings.push({
            severity: 'high',
            category: 'security',
            file: path.relative(localPath, file),
            issue: `Possible ${label} in source`,
            fix: 'Move to .env and add to .gitignore',
          });
        }
      }
    } catch {}
  }

  // Check .env files tracked in git
  const trackedEnv = (git('git ls-files', localPath) || '').split('\n').filter(l =>
    l.includes('.env') && !l.includes('.env.example')
  );
  for (const f of trackedEnv) {
    findings.push({
      severity: 'high',
      category: 'security',
      file: f,
      issue: '.env file tracked in git',
      fix: 'git rm --cached ' + f + ' and add to .gitignore',
    });
  }

  return findings;
}

// ── Dependency audit ──────────────────────────────────────────
function dependencyAudit(localPath) {
  const findings = [];
  const pkgPaths = [
    path.join(localPath, 'package.json'),
    path.join(localPath, 'src', 'frontend', 'package.json'),
  ];

  for (const pkgPath of pkgPaths) {
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});

      // Check for known vulnerable patterns (simple heuristic)
      for (const dep of [...deps, ...devDeps]) {
        const version = (pkg.dependencies || {})[dep] || (pkg.devDependencies || {})[dep];
        if (version && version.startsWith('0.0.0')) {
          findings.push({
            severity: 'low',
            category: 'dependency',
            file: path.relative(localPath, pkgPath),
            issue: `${dep}@${version} uses zero version`,
            fix: 'Pin to a specific version',
          });
        }
      }

      // Check for missing name/version
      if (!pkg.name) findings.push({ severity: 'medium', category: 'dependency', file: path.relative(localPath, pkgPath), issue: 'Missing package name', fix: 'Add name field to package.json' });
      if (!pkg.version) findings.push({ severity: 'medium', category: 'dependency', file: path.relative(localPath, pkgPath), issue: 'Missing package version', fix: 'Add version field to package.json' });
      if (!pkg.description) findings.push({ severity: 'low', category: 'dependency', file: path.relative(localPath, pkgPath), issue: 'Missing description', fix: 'Add description to package.json' });

      // Check for audit advisories (if node_modules exists)
      if (fs.existsSync(path.join(localPath, 'node_modules'))) {
        try {
          const auditOut = execSync('npm audit --audit-level=high 2>&1', { cwd: path.dirname(pkgPath), encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
          if (auditOut.includes('vulnerabilities') && !auditOut.includes('0')) {
            findings.push({
              severity: 'high',
              category: 'dependency',
              file: path.relative(localPath, pkgPath),
              issue: 'npm audit reports high vulnerabilities',
              fix: 'Run npm audit fix or update dependencies',
            });
          }
        } catch {}
      }
    } catch {}
  }

  return findings;
}

// ── Code quality ──────────────────────────────────────────────
function codeQualityCheck(localPath) {
  const findings = [];
  const jsFiles = walkFiles(localPath, 0, 4).filter(f =>
    /\.(js|ts)$/.test(f) && !f.includes('node_modules') && !f.includes('dist')
  );

  if (jsFiles.length === 0) return findings;

  // Check for common code quality issues
  let consoleWarns = 0;
  let emptyCatch = 0;
  let anyUsage = 0;
  let arrowReturn = 0;

  for (const file of jsFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (/\bconsole\.log\b/.test(line)) consoleWarns++;
        if (/\bcatch\s*\(?\s*\w*\s*\)?\s*\{\s*\}/.test(line)) emptyCatch++;
        if (/\bany\b/.test(line) && line.includes(':')) anyUsage++;
        if (/=>\s*\{/.test(line) && !/\breturn\b/.test(line)) arrowReturn++;
      }
    } catch {}
  }

  if (consoleWarns > 20) {
    findings.push({
      severity: 'low',
      category: 'code-quality',
      issue: `${consoleWarns} console.log statements across ${jsFiles.length} files`,
      fix: 'Replace with proper logging library',
    });
  }
  if (emptyCatch > 5) {
    findings.push({
      severity: 'medium',
      category: 'code-quality',
      issue: `${emptyCatch} empty catch blocks`,
      fix: 'Add error handling or rethrow',
    });
  }

  return findings;
}

// ── Test coverage ─────────────────────────────────────────────
function testCoverageCheck(localPath) {
  const findings = [];
  const testFiles = walkFiles(localPath, 0, 5).filter(f =>
    /(\.test\.|\.spec\.|__tests__|\/tests?\/)/.test(f) && !f.includes('node_modules')
  );
  const srcFiles = walkFiles(localPath, 0, 5).filter(f =>
    /\.(js|ts|py)$/.test(f) && !f.includes('node_modules') && !f.includes('dist') && !/(\.test\.|\.spec\.|__tests__|\/tests?\/)/.test(f)
  );

  if (srcFiles.length > 0 && testFiles.length === 0) {
    findings.push({
      severity: 'medium',
      category: 'testing',
      issue: `${srcFiles.length} source files with 0 test files`,
      fix: 'Add unit tests for core modules',
    });
  } else if (testFiles.length > 0) {
    const coverage = Math.round((testFiles.length / srcFiles.length) * 100);
    if (coverage < 30) {
      findings.push({
        severity: 'low',
        category: 'testing',
        issue: `Test coverage estimated at ${coverage}% (${testFiles.length}/${srcFiles.length} files)`,
        fix: 'Increase test coverage',
      });
    }
  }

  return findings;
}

// ── File hygiene ───────────────────────────────────────────────
function fileHygieneCheck(localPath) {
  const findings = [];

  // Large files
  const largeFiles = walkFiles(localPath, 0, 5).filter(f => !f.includes('node_modules') && !f.includes('.git'));
  for (const f of largeFiles) {
    try {
      const stat = fs.statSync(f);
      if (stat.size > 10 * 1024 * 1024) {
        findings.push({
          severity: 'medium',
          category: 'bloat',
          file: path.relative(localPath, f),
          issue: `Large file (${Math.round(stat.size / 1024 / 1024)}MB)`,
          fix: 'Consider splitting or using git-lfs',
        });
      }
    } catch {}
  }

  // .gitignore check
  if (fs.existsSync(path.join(localPath, '.git')) && !fs.existsSync(path.join(localPath, '.gitignore'))) {
    findings.push({
      severity: 'medium',
      category: 'config',
      issue: 'Missing .gitignore',
      fix: 'Add .gitignore with node_modules, .env, logs, dist',
    });
  }

  // Uncommitted changes
  const status = git('git status --short', localPath);
  if (status && status.trim()) {
    const count = status.split('\n').filter(Boolean).length;
    findings.push({
      severity: 'medium',
      category: 'sync',
      issue: `${count} uncommitted changes`,
      fix: 'Commit and push changes',
    });
  }

  return findings;
}

// ── Main inspection ───────────────────────────────────────────
function inspectProject(project) {
  const local = project.local;
  if (!fs.existsSync(local)) {
    return {
      name: project.name,
      exists: false,
      findings: [{ severity: 'high', category: 'config', issue: 'Local path does not exist' }],
      score: 0,
      grade: 'F',
    };
  }

  const allFindings = [
    ...securityScan(local),
    ...dependencyAudit(local),
    ...codeQualityCheck(local),
    ...testCoverageCheck(local),
    ...fileHygieneCheck(local),
  ];

  // Score
  let score = 100;
  for (const f of allFindings) {
    if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 7;
    else if (f.severity === 'low') score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  return {
    name: project.name,
    exists: true,
    findings: allFindings,
    findingCount: allFindings.length,
    highCount: allFindings.filter(f => f.severity === 'high').length,
    mediumCount: allFindings.filter(f => f.severity === 'medium').length,
    lowCount: allFindings.filter(f => f.severity === 'low').length,
    score,
    grade,
    pass: score >= 75,
    timestamp: new Date().toISOString(),
  };
}

function inspectAll() {
  log('=== Quality Inspection Start ===');
  const results = {};
  for (const project of PROJECTS) {
    const result = inspectProject(project);
    results[project.name] = result;
    log(`[${project.name}] ${result.grade} (${result.score}/100) findings=${result.findingCount} high=${result.highCount} med=${result.mediumCount}`);
  }

  // Save state
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      lastRun: new Date().toISOString(),
      results,
    }, null, 2));
  } catch {}

  log('=== Quality Inspection Complete ===');
  return results;
}

function autoRepair(findings, localPath) {
  const repairs = [];
  for (const f of findings) {
    if (f.severity === 'high' && f.category === 'security' && f.issue && f.issue.includes('.env')) {
      try {
        const gitignore = path.join(localPath, '.gitignore');
        let content = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
        if (!content.includes('.env')) {
          content += '\n.env\n.env.*\n!.env.example\n';
          fs.writeFileSync(gitignore, content);
          repairs.push('Updated .gitignore to exclude .env');
        }
        git('git rm --cached ' + f.file + ' 2>&1 || true', localPath);
      } catch {}
    }
    if (f.category === 'config' && f.issue === 'Missing .gitignore') {
      try {
        fs.writeFileSync(path.join(localPath, '.gitignore'), 'node_modules/\n.env\n__pycache__/\n*.pyc\n*.log\ndist/\nbuild/\n.DS_Store\nThumbs.db\n');
        git('git add .gitignore', localPath);
        git('git commit -m "fix: add .gitignore" 2>&1 || true', localPath);
        repairs.push('Created .gitignore');
      } catch {}
    }
  }
  return repairs;
}

const cmd = process.argv[2] || 'inspect';
const target = process.argv[3];

if (cmd === 'inspect') {
  let projects = PROJECTS;
  if (target) projects = PROJECTS.filter(p => p.name === target);
  if (projects.length === 0) { console.log('Project not found: ' + target); process.exit(1); }

  const results = {};
  for (const project of projects) {
    const result = inspectProject(project);
    results[project.name] = result;
    console.log(`\n[${project.name}] ${result.grade} (${result.score}/100)`);
    if (result.findings.length > 0) {
      console.log(`  ${result.highCount} high, ${result.mediumCount} medium, ${result.lowCount} low`);
      for (const f of result.findings.slice(0, 10)) {
        const icon = f.severity === 'high' ? '!' : f.severity === 'medium' ? '~' : '-';
        console.log(`  ${icon} [${f.severity}] ${f.category}: ${f.issue}`);
        if (f.fix) console.log(`     Fix: ${f.fix}`);
      }
      if (result.findings.length > 10) console.log(`  ... ${result.findings.length - 10} more`);
    } else {
      console.log('  No issues found.');
    }

    // Auto-repair if score is low
    if (result.score < 75 && result.exists) {
      const repairs = autoRepair(result.findings, project.local);
      if (repairs.length > 0) {
        console.log(`  Auto-repairs: ${repairs.join('; ')}`);
        git('git add -A', project.local);
        git(`git commit -m "fix(quality): auto-repair ${result.findingCount} findings" 2>&1 || true`, project.local);
      }
    }
  }

  // Save state
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastRun: new Date().toISOString(), results }, null, 2));
  } catch {}

} else if (cmd === 'report') {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    console.log(`\n=== Quality Report (${state.lastRun}) ===\n`);
    for (const [name, r] of Object.entries(state.results)) {
      const icon = r.pass ? 'PASS' : 'FAIL';
      console.log(`  [${icon}] ${name}: ${r.grade} (${r.score}/100) - ${r.findingCount} findings`);
    }
    console.log('');
  } catch {
    console.log('No inspection report yet. Run: node quality-inspector.js inspect');
  }
} else {
  console.log('Usage: node quality-inspector.js <inspect|report> [project]');
}

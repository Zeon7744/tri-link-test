#!/usr/bin/env node
'use strict';

/**
 * Tri-Link DevKit Core
 * Handles all platform interactions: GitHub, Gitee, AFDian, Git.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ─── Utilities ────────────────────────────────────────────────────────────────

function gitRun(args, cwd) {
  try {
    const result = execSync('git ' + args, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 90_000,
      cwd: cwd || process.cwd(),
    }).trim();
    return { ok: true, output: result };
  } catch (err) {
    return {
      ok: false,
      output: (err.stdout?.toString() || err.stderr?.toString() || err.message || '').trim(),
      error: err,
    };
  }
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'tri-link-devkit/1.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'tri-link-devkit/1.0',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(payload);
    req.end();
  });
}

function log(level, message, ...extra) {
  const colors = { ok: '\x1b[32m', warn: '\x1b[33m', err: '\x1b[31m', info: '\x1b[36m' };
  const reset = '\x1b[0m';
  const prefix = { ok: '[OK]', warn: '[WARN]', err: '[ERR]', info: '  »' }[level] || '  ·';
  console.log(`${colors[level] || ''}${prefix}${reset} ${message}`, ...extra);
}

// ─── DevKit Class ─────────────────────────────────────────────────────────────

class DevKit {
  /**
   * @param {object} opts - user-supplied configuration
   * @param {string} [opts.githubUser]
   * @param {string} [opts.giteeUser]
   * @param {string} [opts.afdianUser]
   * @param {string} [opts.githubToken]
   * @param {string} [opts.giteeToken]
   * @param {string} [opts.afdianToken]
   * @param {string} [opts.branch]
   * @param {string} [opts.description]
   */
  constructor(opts = {}) {
    this.githubUser = opts.githubUser || process.env.GITHUB_USER || 'Zeon7744';
    this.giteeUser = opts.giteeUser || process.env.GITEE_USER || 'Zeon7744';
    this.afdianUser = opts.afdianUser || process.env.AFDIAN_USER || 'Zeon7744';
    this.githubToken = opts.githubToken || process.env.GITHUB_TOKEN || '';
    this.giteeToken = opts.giteeToken || process.env.GITEE_TOKEN || '';
    this.afdianToken = opts.afdianToken || process.env.AFDIAN_TOKEN || '';
    this.branch = opts.branch || 'main';
    this.description = opts.description || '';
    this.repoName = opts.repoName || '';
    this.rootDir = opts.rootDir || process.cwd();
  }

  // ── init ─────────────────────────────────────────────────────────────────────

  /**
   * Initialize a new tri-link project in the current directory.
   * Creates: git repo, remotes, FUNDING.yml, README, .gitignore, .github/
   */
  async init(repoName, opts = {}) {
    this.repoName = repoName;
    const ghUser = opts.githubUser || this.githubUser;
    const giteeUser = opts.giteeUser || this.giteeUser;
    const afdianUser = opts.afdianUser || this.afdianUser;
    const desc = opts.description || this.description;

    log('info', `Initializing Tri-Link project: ${repoName}`);
    log('info', `  GitHub : ${ghUser}/${repoName}`);
    log('info', `  Gitee  : ${giteeUser}/${repoName}`);
    log('info', `  AFDian : afdian.com/a/${afdianUser}`);
    console.log('');

    // 1. git init
    const gitInit = gitRun('init', this.rootDir);
    if (!gitInit.ok) {
      log('warn', 'git init failed (repo may already exist)');
    } else {
      log('ok', 'git repo initialized');
    }

    // 2. remotes
    const ghUrl = this.githubToken
      ? `https://${this.githubToken}@github.com/${ghUser}/${repoName}.git`
      : `git@github.com:${ghUser}/${repoName}.git`;
    const giteeUrl = this.giteeToken
      ? `https://oauth2:${this.giteeToken}@gitee.com/${giteeUser}/${repoName}.git`
      : `git@gitee.com:${giteeUser}/${repoName}.git`;

    const originRes = gitRun('remote add origin ' + ghUrl, this.rootDir);
    originRes.ok ? log('ok', `origin (GitHub): ${ghUrl.replace(this.githubToken, '***')}`) : log('warn', 'origin remote already set (skipped)');

    const giteeRes = gitRun('remote add gitee ' + giteeUrl, this.rootDir);
    giteeRes.ok ? log('ok', `gitee: ${giteeUrl.replace(this.giteeToken, '***')}`) : log('warn', 'gitee remote already set (skipped)');

    // 3. .github/ structure
    this._ensureDir('.github');
    this._ensureDir('.github/workflows');

    // FUNDING.yml
    this._writeFile(
      path.join(this.rootDir, '.github', 'FUNDING.yml'),
      [
        '# AFDian (爱发电) sponsorship',
        `custom: ["https://afdian.com/a/${afdianUser}"]`,
        '',
      ].join('\n')
    );
    log('ok', '.github/FUNDING.yml created');

    // GitHub Actions: sync workflow
    this._writeFile(
      path.join(this.rootDir, '.github', 'workflows', 'sync.yml'),
      [
        'name: Tri-Link Sync',
        '',
        'on:',
        '  push:',
        `    branches: [${this.branch}]`,
        '  workflow_dispatch:',
        '',
        'jobs:',
        '  sync:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '        with:',
        '          fetch-depth: 0',
        '      - name: Sync marker',
        '        run: |',
        '          echo "Synced: $(date -u)" > .sync-marker.txt',
        '          cat .sync-marker.txt',
        '      - name: Upload artifact',
        '        uses: actions/upload-artifact@v4',
        '        with:',
        '          name: sync-marker',
        '          path: .sync-marker.txt',
        '          retention-days: 7',
        '',
      ].join('\n')
    );
    log('ok', '.github/workflows/sync.yml created');

    // 4. README.md
    this._writeFile(
      path.join(this.rootDir, 'README.md'),
      this._buildReadme(repoName, ghUser, giteeUser, afdianUser, desc)
    );
    log('ok', 'README.md created');

    // 5. .gitignore
    this._writeFile(
      path.join(this.rootDir, '.gitignore'),
      [
        '# OS',
        '.DS_Store',
        'Thumbs.db',
        '',
        '# IDE',
        '.vscode/',
        '.idea/',
        '',
        '# Node',
        'node_modules/',
        'dist/',
        '',
        '# Python',
        '__pycache__/',
        '*.pyc',
        '.venv/',
        '',
        '# Env',
        '.env',
        '.env.local',
        '',
        '# Tri-Link DevKit generated',
        '.tri-link/',
        '',
      ].join('\n')
    );
    log('ok', '.gitignore created');

    // 6. .tri-link/config.json (project-level config, gitignored)
    this._ensureDir('.tri-link');
    const config = {
      version: '1.0.0',
      repo: repoName,
      created: new Date().toISOString(),
      github: { user: ghUser, token_set: Boolean(this.githubToken) },
      gitee: { user: giteeUser, token_set: Boolean(this.giteeToken) },
      afdian: { user: afdianUser, token_set: Boolean(this.afdianToken) },
      branch: this.branch,
    };
    this._writeFile(
      path.join(this.rootDir, '.tri-link', 'config.json'),
      JSON.stringify(config, null, 2)
    );
    log('ok', '.tri-link/config.json created');

    // 7. First commit
    const addRes = gitRun('add -A', this.rootDir);
    if (addRes.ok) {
      const commitRes = gitRun(
        `commit -m "chore: initialize tri-link project ${repoName}"`,
        this.rootDir
      );
      commitRes.ok ? log('ok', 'initial commit created') : log('warn', 'commit skipped (nothing to commit or no git identity)');
    }

    console.log('');
    log('ok', `Tri-Link project "${repoName}" is ready.`);
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Create repos on GitHub and Gitee (or let DevKit do it)');
    console.log(`    2. Push:  node packages/tri-link-devkit/bin/cli.js push`);
    console.log(`    3. Or use git aliases: git push-all`);
  }

  // ── create-remote ────────────────────────────────────────────────────────────

  /**
   * Create remote repos via API if tokens are provided.
   */
  async createRemotes(repoName, opts = {}) {
    const ghUser = opts.githubUser || this.githubUser;
    const giteeUser = opts.giteeUser || this.giteeUser;

    // GitHub
    if (this.githubToken) {
      try {
        const res = await httpsPost(
          'https://api.github.com/user/repos',
          { name: repoName, description: this.description, private: false },
          { Authorization: 'token ' + this.githubToken }
        );
        if (res.status === 201) {
          log('ok', `GitHub repo created: github.com/${ghUser}/${repoName}`);
        } else if (res.status === 409) {
          log('warn', 'GitHub repo already exists: ' + (res.body?.message || ''));
        } else {
          log('err', `GitHub repo creation failed (HTTP ${res.status}): ${res.body?.message || res.raw}`);
        }
      } catch (err) {
        log('err', 'GitHub API error: ' + err.message);
      }
    } else {
      log('warn', 'GITHUB_TOKEN not set — skipping GitHub repo creation (use SSH instead)');
    }

    // Gitee
    if (this.giteeToken) {
      try {
        const res = await httpsPost(
          'https://gitee.com/api/v5/user/repos',
          { name: repoName, description: this.description, public: true, auto_init: false },
          { Authorization: 'Bearer ' + this.giteeToken }
        );
        if (res.status === 201 || res.body?.id) {
          log('ok', `Gitee repo created: gitee.com/${giteeUser}/${repoName}`);
        } else {
          log('warn', 'Gitee repo may already exist or creation failed: ' + (res.body?.message || res.raw));
        }
      } catch (err) {
        log('err', 'Gitee API error: ' + err.message);
      }
    } else {
      log('warn', 'GITEE_TOKEN not set — skipping Gitee repo creation (use SSH instead)');
    }
  }

  // ── push ─────────────────────────────────────────────────────────────────────

  /**
   * Push current branch to all configured remotes.
   */
  async push(branch = this.branch) {
    const remotes = this._getRemotes();
    if (remotes.length === 0) {
      log('err', 'No remotes configured. Run "init" first.');
      return;
    }

    log('info', `Pushing branch "${branch}" to ${remotes.length} remote(s)...`);
    for (const remote of remotes) {
      const res = gitRun(`push ${remote} ${branch}`, this.rootDir);
      if (res.ok) {
        log('ok', `${remote}: push succeeded`);
      } else {
        log('err', `${remote}: ${res.output}`);
      }
    }
  }

  // ── status ───────────────────────────────────────────────────────────────────

  async status() {
    const remotes = this._getRemotes();
    const branch = this._currentBranch();
    const gitStatus = gitRun('status --porcelain', this.rootDir);
    const dirty = gitStatus.ok && gitStatus.output.length > 0;

    // ahead/behind vs origin
    let ahead = 0, behind = 0;
    if (remotes.includes('origin')) {
      const aheadRes = gitRun(`rev-list --count HEAD..origin/${branch}`, this.rootDir);
      ahead = aheadRes.ok ? parseInt(aheadRes.output || '0', 10) || 0 : null;
      const behindRes = gitRun(`rev-list --count origin/${branch}..HEAD`, this.rootDir);
      behind = behindRes.ok ? parseInt(behindRes.output || '0', 10) || 0 : null;
    }

    return {
      repo: this.repoName || this._repoNameFromGit() || 'unknown',
      branch,
      remotes: remotes.map((r) => ({
        name: r,
        url: gitRun(`remote get-url ${r}`, this.rootDir).output || '',
      })),
      dirty,
      ahead,
      behind,
      timestamp: new Date().toISOString(),
    };
  }

  // ── afdian-stats ─────────────────────────────────────────────────────────────

  /**
   * Fetch live AFDian sponsorship stats.
   */
  async afdianStats() {
    const user = this.afdianUser;
    const afdianConfig = this._loadAfdianConfig();

    if (!afdianConfig) {
      log('warn', 'No AFDian config found. Using public API fallback.');
      // Fallback: fetch the creator page for basic stats
      try {
        const res = await httpsGet(`https://afdian.com/a/${user}`);
        log('ok', `AFDian page fetched (HTTP ${res.status})`);
        log('info', 'Set AFDIAN_TOKEN + AFDIAN_USER env vars for API stats.');
        return { user, source: 'page', available: false };
      } catch (err) {
        log('err', 'AFDian page fetch failed: ' + err.message);
        return { user, source: 'none', available: false, error: err.message };
      }
    }

    try {
      const ts = Math.floor(Date.now() / 1000);
      const raw = `${afdianConfig.token}params{"stat":"1"}ts${ts}user_id${afdianConfig.user_id}`;
      const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
      const body = { user_id: afdianConfig.user_id, params: '{"stat":"1"}', ts, sign };

      const res = await httpsPost(
        `${afdianConfig.api_base || 'https://afdian.com'}/api/open/query-sponsor`,
        body
      );

      if (res.body?.ec === 200 && res.body?.data) {
        const data = res.body.data;
        const stats = {
          user,
          source: 'api',
          available: true,
          total_sponsors: data.total_count ?? data.list?.length ?? 0,
          monthly_income: data.monthly_income ?? 0,
          recent: (data.list || []).slice(0, 5).map((s) => ({
            name: s.author,
            amount: s.amount,
            time: s.time,
          })),
        };
        log('ok', `AFDian stats: ${stats.total_sponsors} sponsors, ¥${stats.monthly_income}/month`);
        return stats;
      }

      log('warn', 'AFDian API returned unexpected response: ' + (res.body?.msg || res.raw?.slice(0, 200)));
      return { user, source: 'api', available: false, error: res.body?.msg };

    } catch (err) {
      log('err', 'AFDian API error: ' + err.message);
      return { user, source: 'api', available: false, error: err.message };
    }
  }

  // ── github-stats ─────────────────────────────────────────────────────────────

  /**
   * Fetch GitHub repo stats via API (no token needed for public repos).
   */
  async githubStats(repoName = this.repoName) {
    if (!repoName) {
      log('err', 'No repo name provided');
      return null;
    }
    try {
      const res = await httpsGet(`https://api.github.com/repos/${this.githubUser}/${repoName}`);
      if (res.status === 200 && res.body) {
        const stats = {
          user: this.githubUser,
          repo: repoName,
          stars: res.body.stargazers_count,
          forks: res.body.forks_count,
          open_issues: res.body.open_issues_count,
          language: res.body.language,
          updated: res.body.updated_at,
        };
        log('ok', `GitHub ${this.githubUser}/${repoName}: ⭐${stats.stars} 🍴${stats.forks} issues:${stats.open_issues}`);
        return stats;
      }
      log('warn', `GitHub API returned HTTP ${res.status}`);
      return null;
    } catch (err) {
      log('err', 'GitHub API error: ' + err.message);
      return null;
    }
  }

  // ── mcp-config ───────────────────────────────────────────────────────────────

  /**
   * Generate MCP configuration files for the user's IDE.
   */
  mcpConfig(opts = {}) {
    const targetDir = opts.targetDir || path.join(this.rootDir, '.mcp');
    this._ensureDir(targetDir);

    const config = {
      mcpServers: {
        afdian: {
          command: 'node',
          args: [path.join(this.rootDir, 'packages', 'afdian-mcp', 'bin', 'server.js')],
          env: {
            AFDIAN_USER: this.afdianUser,
            AFDIAN_TOKEN: this.afdianToken || '<your-afdian-token>',
          },
        },
        github: {
          command: 'node',
          args: [path.join(this.rootDir, 'packages', 'github-api-v2', 'bin', 'server.js')],
          env: {
            GITHUB_USER: this.githubUser,
            GITHUB_REPO: this.repoName || '<repo>',
            GITHUB_TOKEN: this.githubToken || '<your-github-token>',
          },
        },
      },
    };

    const filePath = path.join(targetDir, 'mcp.json');
    this._writeFile(filePath, JSON.stringify(config, null, 2));
    log('ok', `MCP config written: ${filePath}`);
    console.log('');
    console.log('  Add to your IDE:');
    console.log('    VS Code  → .vscode/settings.json → mcpServers');
    console.log('    Cursor   → .cursor/mcp.json');
    console.log('    Claude   → .codex/config.json → mcpServers');
    return filePath;
  }

  // ── dashboard ────────────────────────────────────────────────────────────────

  /**
   * Generate a standalone dashboard HTML file with live stats.
   */
  dashboard(opts = {}) {
    const repoName = opts.repoName || this.repoName || 'unknown-repo';
    const ghUser = opts.githubUser || this.githubUser;
    const afdianUser = opts.afdianUser || this.afdianUser;
    const outDir = opts.outDir || path.join(this.rootDir, 'dashboard');
    this._ensureDir(outDir);

    const html = this._buildDashboardHtml({ repoName, ghUser, afdianUser, githubToken: this.githubToken, afdianUser });
    const filePath = path.join(outDir, 'index.html');
    this._writeFile(filePath, html);
    log('ok', `Dashboard written: ${filePath}`);
    console.log('');
    console.log('  Open in browser: ' + filePath);
    console.log('  Or serve:        npx serve ' + outDir);
    return filePath;
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  _getRemotes() {
    const res = gitRun('remote', this.rootDir);
    if (!res.ok) return [];
    return res.output.split(/\r?\n/).filter(Boolean);
  }

  _currentBranch() {
    const res = gitRun('branch --show-current', this.rootDir);
    return res.ok ? res.output : 'main';
  }

  _repoNameFromGit() {
    const res = gitRun('remote get-url origin', this.rootDir);
    if (!res.ok) return '';
    const match = res.output.match(/[:/]([^\/]+?)(\.git)?$/);
    return match ? match[1] : '';
  }

  _ensureDir(dirPath) {
    const abs = path.isAbsolute(dirPath) ? dirPath : path.join(this.rootDir, dirPath);
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  }

  _writeFile(filePath, content) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(this.rootDir, filePath);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }

  _loadAfdianConfig() {
    const candidates = [
      path.join(this.rootDir, '.tri-link', 'config.json'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.local', 'bin', 'afdian-link-config.json'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {}
    }
    // Fallback: use env vars
    if (this.afdianToken) {
      return { token: this.afdianToken, user_id: this.afdianUser, api_base: 'https://afdian.com' };
    }
    return null;
  }

  _buildReadme(repoName, ghUser, giteeUser, afdianUser, desc) {
    return [
      `# ${repoName}`,
      '',
      desc || 'GitHub + Gitee + AFDian three-way linkage project.',
      '',
      '## Platform Links',
      '',
      '| Platform | URL |',
      '|----------|-----|',
      `| GitHub | https://github.com/${ghUser}/${repoName} |`,
      `| Gitee | https://gitee.com/${giteeUser}/${repoName} |`,
      `| AFDian | https://afdian.com/a/${afdianUser} |`,
      '',
      '## Quick Start',
      '',
      '```bash',
      '# Initialize a new tri-link project',
      `node packages/tri-link-devkit/bin/cli.js init ${repoName} -g ${ghUser} -G ${giteeUser} -A ${afdianUser}`,
      '',
      '# Push to all platforms',
      'node packages/tri-link-devkit/bin/cli.js push',
      '```',
      '',
      '## Sponsor',
      '',
      `If this project helps you, consider supporting the author:`,
      `👉 https://afdian.com/a/${afdianUser}`,
      '',
    ].join('\n');
  }

  _buildDashboardHtml({ repoName, ghUser, afdianUser, afdianToken, githubToken }) {
    const ghRepo = `https://api.github.com/repos/${ghUser}/${repoName}`;
    const afdianUserUrl = `https://afdian.com/a/${afdianUser}`;
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Tri-Link Dashboard · ${repoName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d1117; color: #e6edf3;
      min-height: 100vh; padding: 48px 20px;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 {
      font-size: 1.6em; margin-bottom: 8px;
      background: linear-gradient(135deg, #58a6ff, #a371f7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .sub { color: #8b949e; font-size: .9em; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 16px; }
    .card {
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 24px; text-align: center;
    }
    .val { font-size: 2.2em; font-weight: 700; color: #58a6ff; }
    .lbl { color: #8b949e; font-size: .85em; margin-top: 6px; }
    .links { margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap; }
    .links a {
      color: #58a6ff; text-decoration: none; font-size: .9em;
      background: #161b22; border: 1px solid #30363d;
      border-radius: 6px; padding: 8px 16px;
    }
    .links a:hover { background: #1c2128; }
    .ts { margin-top: 24px; color: #484f58; font-size: .8em; }
    .err { color: #f85149; font-size: .9em; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Tri-Link Dashboard</h1>
    <div class="sub">${repoName} · ${ghUser} · ${new Date().toLocaleDateString('zh-CN')}</div>
    <div class="grid">
      <div class="card"><div class="val" id="gh-stars">—</div><div class="lbl">GitHub Stars</div></div>
      <div class="card"><div class="val" id="gh-forks">—</div><div class="lbl">GitHub Forks</div></div>
      <div class="card"><div class="val" id="gh-issues">—</div><div class="lbl">Open Issues</div></div>
      <div class="card"><div class="val" id="af-sponsors">—</div><div class="lbl">AFDian Sponsors</div></div>
    </div>
    <div class="links">
      <a href="https://github.com/${ghUser}/${repoName}" target="_blank">GitHub</a>
      <a href="https://gitee.com/${ghUser}/${repoName}" target="_blank">Gitee</a>
      <a href="${afdianUserUrl}" target="_blank">AFDian</a>
    </div>
    <div class="ts" id="ts">Loading…</div>
    <div class="err" id="err" style="display:none"></div>
  </div>
  <script>
    const GH_REPO = ${JSON.stringify(ghRepo)};
    const AF_USER = ${JSON.stringify(afdianUserUrl)};

    async function load() {
      // GitHub
      try {
        const res = await fetch(GH_REPO);
        const d = await res.json();
        document.getElementById('gh-stars').textContent = d.stargazers_count ?? '—';
        document.getElementById('gh-forks').textContent = d.forks_count ?? '—';
        document.getElementById('gh-issues').textContent = d.open_issues_count ?? '—';
      } catch {
        document.getElementById('gh-stars').textContent = 'N/A';
        document.getElementById('gh-forks').textContent = 'N/A';
        document.getElementById('gh-issues').textContent = 'N/A';
      }
      // AFDian (fallback: show link)
      document.getElementById('af-sponsors').textContent = '见 AFDian 页面 →';
      document.getElementById('ts').textContent = 'Updated: ' + new Date().toLocaleString('zh-CN');
    }
    load();
  </script>
</body>
</html>`;
  }
}

module.exports = { DevKit };

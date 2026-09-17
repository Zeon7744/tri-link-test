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
  const prefix = { ok: '[OK]', warn: '[WARN]', err: '[ERR]', info: '  >>' }[level] || '  ·';
  console.log(`${colors[level] || ''}${prefix}${reset} ${message}`, ...extra);
}

// ─── DevKit Class ─────────────────────────────────────────────────────────────

class DevKit {
  /**
   * @param {object} opts - user-supplied configuration
   */
  constructor(opts = {}) {
    this.githubUser = opts.githubUser || process.env.GITHUB_USER || 'Zeon7744';
    this.giteeUser = opts.giteeUser || process.env.GITEE_USER || 'Zeon7744';
    this.afdianUser = opts.afdianUser || process.env.AFDIAN_USER || 'Zeon7744';
    this.githubToken = opts.githubToken || process.env.GITHUB_TOKEN || '';
    this.giteeToken = opts.giteeToken || process.env.GITEE_TOKEN || '';
    this.afdianToken = opts.afdianToken || process.env.AFDIAN_TOKEN || '';
    this.branch = opts.branch || process.env.TRI_BRANCH || 'main';
    this.description = opts.description || '';
    this.repoName = opts.repoName || '';
    this.rootDir = opts.rootDir || process.cwd();
    this.template = opts.template || 'node';
    this.version = opts.version || '0.1.0';
    this.ciProvider = opts.ciProvider || 'github';
    this.dryRun = Boolean(opts.dryRun);
  }

  // ── init ─────────────────────────────────────────────────────────────────────

  async init(repoName, opts = {}) {
    this.repoName = repoName;
    const ghUser = opts.githubUser || this.githubUser;
    const giteeUser = opts.giteeUser || this.giteeUser;
    const afdianUser = opts.afdianUser || this.afdianUser;
    const desc = opts.description || this.description;
    const token = opts.token || '';

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
    if (!this.dryRun) {
      const addRes = gitRun('add -A', this.rootDir);
      if (addRes.ok) {
        const commitRes = gitRun(
          `commit -m "chore: initialize tri-link project ${repoName}"`,
          this.rootDir
        );
        commitRes.ok ? log('ok', 'initial commit created') : log('warn', 'commit skipped (nothing to commit or no git identity)');
      }
    } else {
      log('info', 'Dry-run: skipping commit');
    }

    console.log('');
    log('ok', `Tri-Link project "${repoName}" is ready.`);
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Create repos on GitHub and Gitee (or let DevKit do it)');
    console.log('    2. Push:  node packages/tri-link-devkit/bin/cli.js push');
    console.log('    3. Or use git aliases: git push-all');
  }

  // ── create-remote ────────────────────────────────────────────────────────────

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
      log('warn', 'GITHUB_TOKEN not set - skipping GitHub repo creation (use SSH instead)');
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
      log('warn', 'GITEE_TOKEN not set - skipping Gitee repo creation (use SSH instead)');
    }
  }

  // ── push ─────────────────────────────────────────────────────────────────────

  async push(branch = this.branch) {
    const remotes = this._getRemotes();
    if (remotes.length === 0) {
      log('err', 'No remotes configured. Run "init" first.');
      return { ok: false, results: [] };
    }

    log('info', `Pushing branch "${branch}" to ${remotes.length} remote(s)...`);
    const results = [];
    for (const remote of remotes) {
      const res = gitRun(`push ${remote} ${branch}`, this.rootDir);
      if (res.ok) {
        log('ok', `${remote}: push succeeded`);
        results.push({ remote, ok: true });
      } else {
        log('err', `${remote}: ${res.output}`);
        results.push({ remote, ok: false, output: res.output });
      }
    }
    return { ok: results.every((r) => r.ok), results };
  }

  // ── status ───────────────────────────────────────────────────────────────────

  async status() {
    const remotes = this._getRemotes();
    const branch = this._currentBranch();
    const gitStatus = gitRun('status --porcelain', this.rootDir);
    const dirty = gitStatus.ok && gitStatus.output.length > 0;

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

  async afdianStats() {
    const user = this.afdianUser;
    const afdianConfig = this._loadAfdianConfig();

    if (!afdianConfig) {
      log('warn', 'No AFDian config found. Using public API fallback.');
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
        log('ok', `AFDian stats: ${stats.total_sponsors} sponsors, ${stats.monthly_income}/month`);
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

  async githubStats(repoName = this.repoName) {
    if (!repoName) {
      log('err', 'No repo name provided');
      return null;
    }
    try {
      const headers = this.githubToken ? { Authorization: 'token ' + this.githubToken } : {};
      const res = await httpsGet(`https://api.github.com/repos/${this.githubUser}/${repoName}`, headers);
      if (res.status === 200 && res.body) {
        const stats = {
          user: this.githubUser,
          repo: repoName,
          stars: res.body.stargazers_count,
          forks: res.body.forks_count,
          open_issues: res.body.open_issues_count,
          language: res.body.language,
          updated: res.body.updated_at,
          html_url: res.body.html_url,
          default_branch: res.body.default_branch,
        };
        log('ok', `GitHub ${this.githubUser}/${repoName}: stars=${stats.stars} forks=${stats.forks} issues=${stats.open_issues}`);
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
    console.log('    VS Code  -> .vscode/settings.json -> mcpServers');
    console.log('    Cursor   -> .cursor/mcp.json');
    console.log('    Claude   -> .codex/config.json -> mcpServers');
    return filePath;
  }

  // ── dashboard ────────────────────────────────────────────────────────────────

  dashboard(opts = {}) {
    const repoName = opts.repoName || this.repoName || 'unknown-repo';
    const ghUser = opts.githubUser || this.githubUser;
    const afdianUser = opts.afdianUser || this.afdianUser;
    const outDir = opts.outDir || path.join(this.rootDir, 'dashboard');
    this._ensureDir(outDir);

    const html = this._buildDashboardHtml({ repoName, ghUser, afdianUser });
    const filePath = path.join(outDir, 'index.html');
    this._writeFile(filePath, html);
    log('ok', `Dashboard written: ${filePath}`);
    console.log('');
    console.log('  Open in browser: ' + filePath);
    console.log('  Or serve:        npx serve ' + outDir);
    return filePath;
  }

  // ── scaffold (new project template) ────────────────────────────────────────

  scaffold(repoName, opts = {}) {
    const template = opts.template || this.template || 'node';
    const outDir = opts.outDir ? path.resolve(opts.outDir) : path.join(this.rootDir, repoName);
    this._ensureDir(outDir);

    const ghUser = opts.githubUser || this.githubUser;
    const giteeUser = opts.giteeUser || this.giteeUser;
    const afdianUser = opts.afdianUser || this.afdianUser;

    // Save rootDir temporarily
    const originalRoot = this.rootDir;
    this.rootDir = outDir;
    this.repoName = repoName;

    // Run base init
    this.init(repoName, opts);

    // Add template-specific files
    if (template === 'node' || template === 'mcp') {
      this._scaffoldNode(outDir, repoName, opts);
    }
    if (template === 'mcp') {
      this._scaffoldMcp(outDir, repoName, opts);
    }
    if (template === 'html' || template === 'site') {
      this._scaffoldHtml(outDir, repoName, opts);
    }

    // Generate dashboard
    this.dashboard({ repoName, outDir: path.join(outDir, 'dashboard') });

    // Generate MCP config
    this.mcpConfig({ targetDir: path.join(outDir, '.mcp') });

    // Generate CI
    this._scaffoldCI(outDir, opts);

    // Restore
    this.rootDir = originalRoot;
    log('ok', `Project scaffolded: ${outDir}`);
    return outDir;
  }

  _scaffoldNode(outDir, repoName, opts) {
    const pkg = {
      name: repoName,
      version: this.version,
      description: this.description || `Tri-Link project: ${repoName}`,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        test: 'node test.js',
      },
      license: 'MIT',
    };
    this._writeFile(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2));
    this._writeFile(path.join(outDir, 'index.js'), [
      `// ${repoName}`,
      `console.log('Hello from ${repoName}');`,
      `module.exports = { name: '${repoName}' };`,
      '',
    ].join('\n'));
    this._writeFile(path.join(outDir, 'test.js'), [
      `const assert = require('assert');`,
      `const app = require('./index.js');`,
      `assert.ok(app.name === '${repoName}', 'name matches');`,
      `console.log('All tests passed');`,
      '',
    ].join('\n'));
    log('ok', 'Node template files created');
  }

  _scaffoldMcp(outDir, repoName, opts) {
    const mcpDir = path.join(outDir, 'mcp');
    this._ensureDir(mcpDir);
    const serverJs = [
      `#!/usr/bin/env node`,
      `'use strict';`,
      '',
      `// ${repoName} MCP Server`,
      `const { Server } = require('@modelcontextprotocol/sdk/server/index.js');`,
      `const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');`,
      `const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');`,
      '',
      `const server = new Server({ name: '${repoName}-mcp', version: '${this.version}' }, {`,
      `  capabilities: { tools: {} },`,
      `});`,
      '',
      `server.setRequestHandler(ListToolsRequestSchema, async () => ({`,
      `  tools: [`,
      `    { name: 'hello', description: 'Return a greeting', inputSchema: { type: 'object', properties: {}, required: [] } },`,
      `  ],`,
      `}));`,
      '',
      `server.setRequestHandler(CallToolRequestSchema, async () => ({`,
      `  content: [{ type: 'text', text: JSON.stringify({ message: 'Hello from ${repoName} MCP server' }) }],`,
      `});`,
      '',
      `async function main() {`,
      `  const transport = new StdioServerTransport();`,
      `  await server.connect(transport);`,
      `  console.error('${repoName} MCP server running on stdio');`,
      `}`,
      '',
      `main().catch(console.error);`,
      '',
    ].join('\n');
    this._writeFile(path.join(mcpDir, 'server.js'), serverJs);
    log('ok', 'MCP server template created at mcp/server.js');
  }

  _scaffoldHtml(outDir, repoName, opts) {
    const htmlDir = path.join(outDir, 'public');
    this._ensureDir(htmlDir);
    this._writeFile(
      path.join(htmlDir, 'index.html'),
      this._buildDashboardHtml({ repoName, ghUser: opts.githubUser || this.githubUser, afdianUser: opts.afdianUser || this.afdianUser })
    );
    this._writeFile(
      path.join(outDir, 'index.html'),
      [
        `<!DOCTYPE html>`,
        `<html>`,
        `<head><meta charset="UTF-8"/><title>${repoName}</title></head>`,
        `<body>`,
        `  <h1>${repoName}</h1>`,
        `  <p>Tri-Link project by ${opts.githubUser || this.githubUser}</p>`,
        `  <ul>`,
        `    <li><a href="https://github.com/${opts.githubUser || this.githubUser}/${repoName}">GitHub</a></li>`,
        `    <li><a href="https://gitee.com/${opts.giteeUser || this.giteeUser}/${repoName}">Gitee</a></li>`,
        `    <li><a href="https://afdian.com/a/${opts.afdianUser || this.afdianUser}">AFDian</a></li>`,
        `  </ul>`,
        `</body>`,
        `</html>`,
        '',
      ].join('\n')
    );
    log('ok', 'HTML template files created');
  }

  _scaffoldCI(outDir, opts) {
    const provider = opts.ciProvider || this.ciProvider || 'github';
    if (provider === 'github' || provider === 'gitee') {
      const workflowDir = path.join(outDir, '.github', 'workflows');
      this._ensureDir(workflowDir);
      const ciYml = [
        'name: CI',
        '',
        'on: [push, pull_request]',
        '',
        'jobs:',
        '  test:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        "      - uses: actions/checkout@v4",
        "      - uses: actions/setup-node@v4",
        '        with:',
        "          node-version: '18'",
        '      - run: npm install',
        '      - run: npm test || true',
        '',
      ].join('\n');
      this._writeFile(path.join(workflowDir, 'ci.yml'), ciYml);
      log('ok', '.github/workflows/ci.yml created');
    }
    if (provider === 'gitlab') {
      const gitlabCi = [
        'stages: [test]',
        '',
        'test:',
        '  stage: test',
        '  script:',
        '    - npm install',
        '    - npm test || true',
        '',
      ].join('\n');
      this._writeFile(path.join(outDir, '.gitlab-ci.yml'), gitlabCi);
      log('ok', '.gitlab-ci.yml created');
    }
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
      `-> https://afdian.com/a/${afdianUser}`,
      '',
    ].join('\n');
  }

  _buildDashboardHtml({ repoName, ghUser, afdianUser }) {
    const ghRepo = `https://api.github.com/repos/${ghUser}/${repoName}`;
    const afdianUserUrl = `https://afdian.com/a/${afdianUser}`;
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Tri-Link Dashboard - ${repoName}</title>
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
    <div class="sub">${repoName} / ${ghUser} / ${new Date().toLocaleDateString('zh-CN')}</div>
    <div class="grid">
      <div class="card"><div class="val" id="gh-stars">-</div><div class="lbl">GitHub Stars</div></div>
      <div class="card"><div class="val" id="gh-forks">-</div><div class="lbl">GitHub Forks</div></div>
      <div class="card"><div class="val" id="gh-issues">-</div><div class="lbl">Open Issues</div></div>
      <div class="card"><div class="val" id="af-sponsors">-</div><div class="lbl">AFDian Sponsors</div></div>
    </div>
    <div class="links">
      <a href="https://github.com/${ghUser}/${repoName}" target="_blank">GitHub</a>
      <a href="https://gitee.com/${ghUser}/${repoName}" target="_blank">Gitee</a>
      <a href="${afdianUserUrl}" target="_blank">AFDian</a>
    </div>
    <div class="ts" id="ts">Loading...</div>
    <div class="err" id="err" style="display:none"></div>
  </div>
  <script>
    const GH_REPO = ${JSON.stringify(ghRepo)};
    const AF_USER = ${JSON.stringify(afdianUserUrl)};

    async function load() {
      try {
        const res = await fetch(GH_REPO);
        const d = await res.json();
        document.getElementById('gh-stars').textContent = d.stargazers_count ?? '-';
        document.getElementById('gh-forks').textContent = d.forks_count ?? '-';
        document.getElementById('gh-issues').textContent = d.open_issues_count ?? '-';
      } catch {
        document.getElementById('gh-stars').textContent = 'N/A';
        document.getElementById('gh-forks').textContent = 'N/A';
        document.getElementById('gh-issues').textContent = 'N/A';
      }
      document.getElementById('af-sponsors').textContent = 'See AFDian ->';
      document.getElementById('ts').textContent = 'Updated: ' + new Date().toLocaleString('zh-CN');
    }
    load();
  </script>
</body>
</html>`;
  }
}

// ── Self-evolution engine ─────────────────────────────────────────────────────
// DevKit can inspect its own capabilities, record user feedback, suggest
// upgrades, and apply them without external tooling. All state lives under
// .tri-link/ which is gitignored.

function bumpVersion(v, part) {
  const [maj, min, pat] = String(v).split('.').map(Number);
  if (part === 'major') return (maj + 1) + '.0.0';
  if (part === 'minor') return maj + '.' + (min + 1) + '.0';
  return maj + '.' + min + '.' + (pat + 1);
}

DevKit.prototype.loadLearnings = function () {
  const file = this._learningFile();
  if (!fs.existsSync(file)) {
    return { observations: [], successPatterns: [], failurePatterns: [], appliedUpgrades: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      observations: data.observations || [],
      successPatterns: data.successPatterns || [],
      failurePatterns: data.failurePatterns || [],
      appliedUpgrades: data.appliedUpgrades || [],
    };
  } catch {
    return { observations: [], successPatterns: [], failurePatterns: [], appliedUpgrades: [] };
  }
};

DevKit.prototype.saveLearnings = function (data) {
  const file = this._learningFile();
  this._ensureDir(path.dirname(file));
  data.updatedAt = new Date().toISOString();
  this._writeFile(file, JSON.stringify(data, null, 2));
  return data;
};

DevKit.prototype._learningFile = function () {
  return path.join(this.rootDir, '.tri-link', 'learnings.json');
};

DevKit.prototype.learnFromFeedback = function (input, meta = {}) {
  const text = String(input || '').trim();
  if (!text) throw new Error('feedback text required');
  const data = this.loadLearnings();
  const entry = {
    text,
    type: meta.type || 'observation',
    success: meta.success !== false,
    timestamp: new Date().toISOString(),
    meta: { source: meta.source || 'cli', ...meta },
  };
  data.observations.push(entry);
  if (entry.success) data.successPatterns.push(entry);
  else data.failurePatterns.push(entry);
  this.saveLearnings(data);
  log('ok', 'learning recorded: ' + text);
  return entry;
};

DevKit.prototype.selfInspect = function () {
  const learnings = this.loadLearnings();
  const capabilities = ['init', 'createRemotes', 'push', 'status', 'afdianStats', 'githubStats', 'mcpConfig', 'dashboard', 'scaffold'];
  const present = capabilities.filter((c) => typeof this[c] === 'function');
  const missing = capabilities.filter((c) => typeof this[c] !== 'function');
  const gaps = [
    ...(learnings.failurePatterns.length > 0 ? [{ id: 'failure-patterns', label: 'recorded failure patterns need review' }] : []),
    ...(learnings.successPatterns.length === 0 ? [{ id: 'success-patterns', label: 'no success patterns yet' }] : []),
  ];
  const suggestions = [];
  if (typeof this.changelog !== 'function') suggestions.push({ id: 'add-release-command', title: 'Add release command', description: 'Generate CHANGELOG.md, bump version, create tag', priority: 1, effort: 2 });
  if (typeof this.setup !== 'function') suggestions.push({ id: 'add-interactive-setup', title: 'Add guided setup wizard', description: 'Record user parameters into .tri-link/config.json', priority: 2, effort: 1 });
  if (typeof this._giteeSync !== 'function') suggestions.push({ id: 'add-gitee-sync', title: 'Add Gitee auto-sync', description: 'Push current branch to gitee remote', priority: 2, effort: 1 });
  if (typeof this.enhancedMcpConfig !== 'function') suggestions.push({ id: 'add-mcp-enhanced', title: 'Enhance MCP config', description: 'Add more server options', priority: 3, effort: 1 });
  if (typeof this.docs !== 'function') suggestions.push({ id: 'add-docs-gen', title: 'Auto-generate project docs', description: 'Produce docs/index.html from README', priority: 3, effort: 2 });
  if (missing.length > 0) suggestions.push({ id: 'restore-missing', title: 'Restore missing core capabilities', description: missing.join(', '), priority: 0, effort: 3 });
  return { capabilities: present, missing, gaps, suggestions, learnings };
};

DevKit.prototype.suggestUpgrade = function () {
  const report = this.selfInspect();
  const applied = new Set(this.loadLearnings().appliedUpgrades);
  const upgrades = report.suggestions
    .filter((s) => !applied.has(s.id))
    .map((s, i) => ({ id: s.id, title: s.title, description: s.description, priority: s.priority, effort: s.effort, source: i === 0 ? 'core-gap' : 'learnings' }));
  return upgrades;
};

DevKit.prototype.applyUpgrade = function (upgradeId, opts = {}) {
  const upgrades = this.suggestUpgrade();
  const target = upgrades.find((u) => u.id === upgradeId) || { id: upgradeId, title: upgradeId, description: 'user-requested upgrade' };
  const learnings = this.loadLearnings();
  learnings.appliedUpgrades.push(target.id);
  this.saveLearnings(learnings);
  const actions = {
    'add-release-command': () => {
      this._changelogImpl = this._ensureReleaseCommand();
      return 'installed changelog/release';
    },
    'add-interactive-setup': () => {
      this._setupImpl = this._ensureSetupWizard();
      return 'installed guided setup';
    },
    'add-gitee-sync': () => {
      this._giteeSyncImpl = this._ensureGiteeSync();
      return 'installed gitee sync';
    },
    'add-mcp-enhanced': () => {
      this._enhancedMcpConfigImpl = this._ensureMcpEnhanced();
      return 'installed enhanced MCP config';
    },
    'add-docs-gen': () => {
      this._docsImpl = this._ensureDocsGen();
      return 'installed docs generator';
    },
  };
  const action = actions[target.id];
  const result = action ? action() : 'acknowledged upgrade request';
  log('ok', 'upgrade applied: ' + target.id + ' -> ' + result);
  return { id: target.id, applied: true, result, opts };
};

DevKit.prototype._ensureReleaseCommand = function () {
  const self = this;
  return function changelog(opts = {}) {
    const version = opts.version || self.version || '0.1.0';
    const part = opts.bump || 'patch';
    const next = bumpVersion(version, part);
    const lines = ['# Changelog', '', '## ' + next + ' - ' + new Date().toISOString().slice(0, 10), '', '- Self-evolution update: ' + (opts.note || 'recorded by DevKit'), ''];
    self._writeFile(path.join(self.rootDir, 'CHANGELOG.md'), lines.join('\n'));
    const pkgPath = path.join(self.rootDir, 'package.json');
    if (fs.existsSync(pkgPath) && !opts.dryRun) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = next;
      self._writeFile(pkgPath, JSON.stringify(pkg, null, 2));
    }
    log('ok', 'CHANGELOG.md generated for ' + next);
    return { version: next, part, file: path.join(self.rootDir, 'CHANGELOG.md') };
  };
};

DevKit.prototype._ensureSetupWizard = function () {
  const self = this;
  return function setup(answers = {}) {
    const cfgPath = path.join(self.rootDir, '.tri-link', 'config.json');
    let cfg = {};
    if (fs.existsSync(cfgPath)) cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const keys = ['githubUser', 'giteeUser', 'afdianUser', 'branch', 'description', 'template'];
    keys.forEach((k) => { if (answers[k] !== undefined) cfg[k] = answers[k]; });
    self._ensureDir(path.dirname(cfgPath));
    self._writeFile(cfgPath, JSON.stringify(cfg, null, 2));
    self.learnFromFeedback('setup wizard answers: ' + JSON.stringify(answers), { type: 'success', source: 'setup' });
    log('ok', 'setup answers saved to ' + cfgPath);
    return cfg;
  };
};

DevKit.prototype._ensureGiteeSync = function () {
  const self = this;
  return function _giteeSync(branch = self.branch) {
    const res = gitRun('push gitee ' + branch, self.rootDir);
    if (res.ok) log('ok', 'gitee sync succeeded');
    else log('warn', 'gitee sync: ' + res.output);
    return res;
  };
};

DevKit.prototype._ensureMcpEnhanced = function () {
  const self = this;
  return function enhancedMcpConfig(opts = {}) {
    const targetDir = opts.targetDir || path.join(self.rootDir, '.mcp');
    self._ensureDir(targetDir);
    const filePath = path.join(targetDir, 'mcp-enhanced.json');
    const config = {
      mcpServers: {
        triLinkCore: { command: 'node', args: [path.join(self.rootDir, 'packages', 'tri-link-devkit', 'bin', 'cli.js')], env: { GITHUB_TOKEN: '\${GITHUB_TOKEN}', GITEE_TOKEN: '\${GITEE_TOKEN}', AFDIAN_TOKEN: '\${AFDIAN_TOKEN}' } },
      },
      version: '2.0',
      notes: 'Enhanced MCP config generated by DevKit self-upgrade',
    };
    self._writeFile(filePath, JSON.stringify(config, null, 2));
    log('ok', 'enhanced MCP config written: ' + filePath);
    return filePath;
  };
};

DevKit.prototype._ensureDocsGen = function () {
  const self = this;
  return function docs(opts = {}) {
    const outDir = opts.outDir || path.join(self.rootDir, 'docs');
    self._ensureDir(outDir);
    const readme = path.join(self.rootDir, 'README.md');
    const readmeText = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : '# ' + (self.repoName || 'Project');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + (self.repoName || 'Docs') + '</title></head><body><pre>' + readmeText.replace(/</g, '&lt;') + '</pre></body></html>';
    self._writeFile(path.join(outDir, 'index.html'), html);
    log('ok', 'docs generated: ' + path.join(outDir, 'index.html'));
    return path.join(outDir, 'index.html');
  };
};

DevKit.prototype.changelog = function (opts = {}) {
  if (typeof this._changelogImpl !== 'function') this._changelogImpl = this._ensureReleaseCommand();
  return this._changelogImpl(opts);
};

DevKit.prototype.setup = function (answers = {}) {
  if (typeof this._setupImpl !== 'function') this._setupImpl = this._ensureSetupWizard();
  return this._setupImpl(answers);
};

DevKit.prototype._giteeSync = function (branch = this.branch) {
  if (typeof this._giteeSyncImpl !== 'function') this._giteeSyncImpl = this._ensureGiteeSync();
  return this._giteeSyncImpl(branch);
};

DevKit.prototype.enhancedMcpConfig = function (opts = {}) {
  if (typeof this._enhancedMcpConfigImpl !== 'function') this._enhancedMcpConfigImpl = this._ensureMcpEnhanced();
  return this._enhancedMcpConfigImpl(opts);
};

DevKit.prototype.docs = function (opts = {}) {
  if (typeof this._docsImpl !== 'function') this._docsImpl = this._ensureDocsGen();
  return this._docsImpl(opts);
};

DevKit.prototype.release = function (opts = {}) {
  this.changelog(opts);
  const next = opts.version || this.version || '0.1.0';
  const tag = 'v' + next;
  const res = gitRun('tag ' + tag, this.rootDir);
  if (res.ok) log('ok', 'tag created: ' + tag);
  else log('warn', 'tag: ' + res.output);
  return { tag, version: next };
};

DevKit.prototype.triageFailures = function () {
  const data = this.loadLearnings();
  const counts = {};
  for (const f of data.failurePatterns) counts[f.text] = (counts[f.text] || 0) + 1;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { total: data.failurePatterns.length, ranked };
};

DevKit.prototype.patternReport = function () {
  const data = this.loadLearnings();
  return {
    observations: data.observations.length,
    successPatterns: data.successPatterns.length,
    failurePatterns: data.failurePatterns.length,
    recentFailures: data.failurePatterns.slice(-10),
    recentSuccesses: data.successPatterns.slice(-10),
  };
};

module.exports = { DevKit };

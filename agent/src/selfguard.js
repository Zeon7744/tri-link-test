'use strict';
/**
 * SelfGuard - unified self-check, self-repair, cross-platform comparison,
 * heat analysis, periodic iteration, and dead-code detection for Tri-Link.
 *
 * Exposed through:
 *   agent/bin/agent-cli.js self
 *
 * SelfGuard is the single command that answers:
 *   - Is the tri-link system healthy?
 *   - Can it repair itself?
 *   - Are GitHub and Gitee data in sync?
 *   - What should we do next to gain attention?
 *   - Which files/tasks are stale and should be pruned?
 */

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function gitRun(args, cwd = PROJECT_ROOT) {
  try {
    const out = execSync('git ' + args, { encoding: 'utf8', stdio: 'pipe', cwd, timeout: 30_000 }).trim();
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, output: (err.stdout?.toString() || err.stderr?.toString() || err.message || '').trim() };
  }
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'tri-link-selfguard/1.0', ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

class SelfGuard {
  constructor(opts = {}) {
    this.rootDir = opts.rootDir || PROJECT_ROOT;
    this.githubToken = opts.githubToken || process.env.GITHUB_TOKEN || '';
    this.giteeToken = opts.giteeToken || process.env.GITEE_TOKEN || '';
    this.githubUser = opts.githubUser || process.env.GITHUB_USER || 'Zeon7744';
    this.giteeUser = opts.giteeUser || process.env.GITEE_USER || 'Zeon7744';
    this.repoName = opts.repoName || 'tri-link-test';
    this.dryRun = Boolean(opts.dryRun);
  }

  /**
   * Run the full self-guard cycle.
   */
  async run() {
    const report = {
      timestamp: new Date().toISOString(),
      health: {},
      selfRepair: {},
      crossPlatform: {},
      heat: {},
      iteration: {},
      cleanup: {},
      status: 'ok',
    };

    // 1. Health
    report.health = await this.checkHealth();
    this.healthChecks = report.health.checks;
    if (report.health.alerts.some((a) => a.level === 'error')) report.status = 'degraded';

    // 2. Self-repair (dry-run by default)
    report.selfRepair = this.repair(report.health);

    // 3. Cross-platform comparison
    report.crossPlatform = await this.comparePlatforms();

    // 4. Heat analysis
    report.heat = this.analyzeHeat(report.crossPlatform);

    // 5. Periodic iteration suggestions

    // 6. Dead / stale code detection
    report.cleanup = this.detectDeadCode();

    // 5b. Iteration suggestions (after cleanup is populated)
    report.iteration = this.suggestIteration(report);

    return report;
  }

  /**
   * Check health of all three platforms + local git.
   */
  async checkHealth() {
    const checks = {
      github: await this._probe('https://api.github.com/repos/' + this.githubUser + '/' + this.repoName, this.githubToken ? { Authorization: 'token ' + this.githubToken } : {}),
      gitee: await this._probe('https://gitee.com/api/v5/repos/' + this.giteeUser + '/' + this.repoName, this.giteeToken ? { Authorization: 'Bearer ' + this.giteeToken } : {}),
      afdian: await this._probe('https://afdian.com/a/' + this.githubUser, {}),
      git: this._gitStatus(),
    };

    const alerts = [];
    for (const [name, result] of Object.entries(checks)) {
      if (result.status === 'error') alerts.push({ level: 'error', check: name, message: result.message });
      else if (result.status === 'warning') alerts.push({ level: 'warning', check: name, message: result.message });
    }

    return { checks, alerts, ok: alerts.every((a) => a.level === 'warning') };
  }

  async _probe(url, headers) {
    try {
      const res = await httpsGet(url, headers);
      if (res.status === 200) return { status: 'ok', data: res.body, message: 'OK' };
      return { status: 'warning', message: 'HTTP ' + res.status, data: res.body };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  _gitStatus() {
    const branchRes = gitRun('branch --show-current', this.rootDir);
    const statusRes = gitRun('status --porcelain', this.rootDir);
    const aheadRes = gitRun('rev-list --count HEAD..origin/main', this.rootDir);
    const dirty = statusRes.ok && statusRes.output.length > 0;
    const ahead = aheadRes.ok ? parseInt(aheadRes.output, 10) || 0 : 0;
    const behind = gitRun('rev-list --count origin/main..HEAD', this.rootDir);
    const behindCount = behind.ok ? parseInt(behind.output, 10) || 0 : 0;

    let status = 'ok';
    let message = 'In sync';
    if (dirty || ahead > 0 || behindCount > 0) {
      status = 'warning';
      message = [
        dirty ? 'dirty working tree' : '',
        ahead > 0 ? ahead + ' ahead of origin' : '',
        behindCount > 0 ? behindCount + ' behind origin' : '',
      ].filter(Boolean).join(', ');
    }

    return { status, branch: branchRes.ok ? branchRes.output : 'unknown', dirty, ahead, behind: behindCount, message };
  }

  /**
   * Suggest self-repair actions for detected alerts.
   */
  repair(health) {
    const actions = [];
    for (const alert of health.alerts) {
      if (alert.level !== 'error') continue;
      if (alert.check === 'git' && alert.message.includes('ahead')) {
        actions.push({
          id: 'push-origin',
          check: alert.check,
          command: 'git push origin main',
          description: 'Push local commits to GitHub',
          safe: true,
          executed: this.dryRun ? false : this._tryPush('origin'),
        });
      }
      if (alert.check === 'git' && alert.message.includes('dirty')) {
        actions.push({
          id: 'commit-dirty',
          check: alert.check,
          command: 'git add -A && git commit -m "chore: auto-commit dirty state"',
          description: 'Auto-commit uncommitted changes',
          safe: true,
          executed: this.dryRun ? false : this._tryCommit(),
        });
      }
      if (alert.check === 'gitee') {
        actions.push({
          id: 'push-gitee',
          check: alert.check,
          command: 'git push gitee main',
          description: 'Push to Gitee mirror',
          safe: true,
          executed: this.dryRun ? false : this._tryPush('gitee'),
        });
      }
    }
    return { actions, dryRun: this.dryRun, repaired: actions.filter((a) => a.executed).length };
  }

  _tryPush(remote) {
    const res = gitRun('push ' + remote + ' main', this.rootDir);
    return res.ok;
  }

  _tryCommit() {
    const addRes = gitRun('add -A', this.rootDir);
    if (!addRes.ok) return false;
    const commitRes = gitRun('commit -m "chore: auto-commit by self-guard"', this.rootDir);
    return commitRes.ok || commitRes.output.includes('nothing to commit');
  }

  /**
   * Compare GitHub vs Gitee repo metadata and branch refs.
   */
  async comparePlatforms() {
    const gh = this.healthChecks?.github || { data: null };
    const gitee = this.healthChecks?.gitee || { data: null };

    const result = {
      github: { user: this.githubUser, repo: this.repoName },
      gitee: { user: this.giteeUser, repo: this.repoName },
      synced: true,
      differences: [],
    };

    const ghHeaders = this.githubToken ? { Authorization: 'token ' + this.githubToken } : {};
    const giteeHeaders = this.giteeToken ? { Authorization: 'Bearer ' + this.giteeToken } : {};
    try {
      const [ghRes, giteeRes] = await Promise.all([
        httpsGet('https://api.github.com/repos/' + this.githubUser + '/' + this.repoName, ghHeaders),
        httpsGet('https://gitee.com/api/v5/repos/' + this.giteeUser + '/' + this.repoName, giteeHeaders),
      ]);

      if (ghRes.status === 200 && ghRes.body) {
        result.github.stars = ghRes.body.stargazers_count;
        result.github.forks = ghRes.body.forks_count;
        result.github.open_issues = ghRes.body.open_issues_count;
        result.github.updated = ghRes.body.updated_at;
        result.github.default_branch = ghRes.body.default_branch;
        result.github.html_url = ghRes.body.html_url;
      }

      if (giteeRes.status === 200 && giteeRes.body) {
        result.gitee.stars = giteeRes.body.stars_count;
        result.gitee.forks = giteeRes.body.forks_count;
        result.gitee.description = giteeRes.body.description;
        result.gitee.updated = giteeRes.body.updated_at;
        result.gitee.default_branch = giteeRes.body.default_branch;
        result.gitee.html_url = giteeRes.body.html_url;
      }

      // Compare key fields
      if (ghRes.body && giteeRes.body) {
        const ghData = ghRes.body;
        const giteeData = giteeRes.body;
        if (ghData.default_branch !== giteeData.default_branch) {
          result.differences.push({ field: 'default_branch', github: ghData.default_branch, gitee: giteeData.default_branch });
        }
        if (ghData.stargazers_count !== giteeData.stars_count) {
          result.differences.push({ field: 'stars', github: ghData.stargazers_count, gitee: giteeData.stars_count, note: 'Star counts differ between platforms' });
        }
        if (ghData.forks_count !== giteeData.forks_count) {
          result.differences.push({ field: 'forks', github: ghData.forks_count, gitee: giteeData.forks_count, note: 'Fork counts differ between platforms' });
        }
        const ghTime = new Date(ghData.updated_at).getTime();
        const giteeTime = new Date(giteeData.updated_at).getTime();
        if (Math.abs(ghTime - giteeTime) > 5 * 60 * 1000) {
          result.differences.push({ field: 'updated_at', github: ghData.updated_at, gitee: giteeData.updated_at, note: 'Update times differ by more than 5 minutes' });
        }
      }

      result.synced = result.differences.length === 0;
    } catch (err) {
      result.error = err.message;
      result.synced = false;
    }

    this.lastComparison = result;
    return result;
  }

  /**
   * Heat / attention analysis based on cross-platform data.
   */
  analyzeHeat(comparison) {
    const heat = {
      score: 0,
      factors: [],
      recommendations: [],
    };

    if (!comparison || !comparison.github) return heat;

    const ghStars = comparison.github.stars || 0;
    const ghForks = comparison.github.forks || 0;
    const giteeStars = comparison.gitee?.stars || 0;
    const giteeForks = comparison.gitee?.forks || 0;

    // Factor 1: total stars
    const totalStars = ghStars + giteeStars;
    if (totalStars >= 100) { heat.score += 40; heat.factors.push({ factor: 'total_stars', value: totalStars, weight: 40 }); }
    else if (totalStars >= 10) { heat.score += 20; heat.factors.push({ factor: 'total_stars', value: totalStars, weight: 20 }); }
    else if (totalStars >= 1) { heat.score += 5; heat.factors.push({ factor: 'total_stars', value: totalStars, weight: 5 }); }

    // Factor 2: forks
    const totalForks = ghForks + giteeForks;
    if (totalForks >= 10) { heat.score += 30; heat.factors.push({ factor: 'total_forks', value: totalForks, weight: 30 }); }
    else if (totalForks >= 1) { heat.score += 10; heat.factors.push({ factor: 'total_forks', value: totalForks, weight: 10 }); }

    // Factor 3: sync status
    if (comparison.synced) {
      heat.score += 15;
      heat.factors.push({ factor: 'synced', value: true, weight: 15 });
    } else {
      heat.recommendations.push('Fix sync differences between GitHub and Gitee before promoting.');
    }

    // Factor 4: recency
    const ghUpdated = comparison.github.updated ? new Date(comparison.github.updated).getTime() : 0;
    const daysSinceUpdate = ghUpdated ? (Date.now() - ghUpdated) / (1000 * 60 * 60 * 24) : 999;
    if (daysSinceUpdate < 7) {
      heat.score += 15;
      heat.factors.push({ factor: 'recently_updated', value: Math.round(daysSinceUpdate) + 'd ago', weight: 15 });
    } else if (daysSinceUpdate < 30) {
      heat.score += 5;
      heat.factors.push({ factor: 'somewhat_recent', value: Math.round(daysSinceUpdate) + 'd ago', weight: 5 });
    }

    heat.score = Math.min(100, heat.score);
    heat.level = heat.score >= 70 ? 'hot' : heat.score >= 40 ? 'warm' : 'cold';

    // Generate recommendations
    if (heat.level === 'cold') {
      heat.recommendations.push('Add a clear README with badges and quick-start.');
      heat.recommendations.push('Publish to npm so npx works for new users.');
      heat.recommendations.push('Cross-post to Gitee and AFDian to gain initial stars.');
    }
    if (heat.level === 'warm') {
      heat.recommendations.push('Write a blog post or demo video about the tri-link workflow.');
      heat.recommendations.push('Add GitHub Trending-friendly keywords to README.');
    }
    if (heat.level === 'hot') {
      heat.recommendations.push('Maintain cadence; consider a v2.0 release with new features.');
    }

    return heat;
  }

  /**
   * Suggest the next iteration tasks based on current state.
   */
  suggestIteration(report) {
    const suggestions = [];

    if (!report.selfRepair.repaired && report.selfRepair.actions.length > 0) {
      suggestions.push({
        id: 'fix-repair',
        title: 'Complete pending self-repair actions',
        detail: report.selfRepair.actions.map((a) => a.id).join(', '),
        priority: 'high',
      });
    }

    if (!report.crossPlatform.synced) {
      suggestions.push({
        id: 'sync-platforms',
        title: 'Reconcile GitHub/Gitee differences',
        detail: JSON.stringify(report.crossPlatform.differences),
        priority: 'high',
      });
    }

    if (report.heat.level === 'cold' || report.heat.level === 'warm') {
      suggestions.push({
        id: 'boost-heat',
        title: 'Increase project visibility',
        detail: report.heat.recommendations.join('; '),
        priority: 'medium',
      });
    }

    const dirty = report.health.checks.git?.dirty;
    if (dirty) {
      suggestions.push({
        id: 'commit-pending',
        title: 'Commit uncommitted work',
        detail: 'Working tree is dirty.',
        priority: 'high',
      });
    }

    if ((report.cleanup || {}).staleFiles && report.cleanup.staleFiles.length > 0) {
      suggestions.push({
        id: 'prune-stale',
        title: 'Prune stale files',
        detail: report.cleanup.staleFiles.join(', '),
        priority: 'low',
      });
    }

    return { suggestions, count: suggestions.length };
  }

  /**
   * Detect files that have not been touched in a while or are unused.
   */
  detectDeadCode() {
    const result = { staleFiles: [], unusedDir: [], notes: [] };

    // Check for test-mcp directories (temp artifacts)
    const pkgDir = path.join(this.rootDir, 'packages');
    if (fs.existsSync(pkgDir)) {
      const entries = fs.readdirSync(pkgDir);
      for (const e of entries) {
        if (/^test-mcp-/.test(e)) {
          result.unusedDir.push(path.join('packages', e));
        }
      }
    }

    // Check for .tgz files in package dirs (npm pack artifacts)
    const tgzFiles = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.tgz')) tgzFiles.push(full.replace(this.rootDir + path.sep, ''));
      }
    };
    walk(path.join(this.rootDir, 'packages'));
    walk(path.join(this.rootDir, 'agent'));

    if (tgzFiles.length > 0) {
      result.staleFiles.push(...tgzFiles.map((f) => 'pack artifact: ' + f));
      result.notes.push('Remove .tgz files from repo or add to .gitignore');
    }

    // Check for .mcp and dashboard committed examples
    for (const p of ['.mcp/mcp.json', 'dashboard/index.html']) {
      if (fs.existsSync(path.join(this.rootDir, p))) {
        result.notes.push('Committed example artifact: ' + p);
      }
    }

    return result;
  }

  /**
   * Run and return the full report as a JSON string.
   */
  /**
   * Prune detected unused test-mcp-* directories (generated test artifacts).
   * apply=false is a dry-run that only reports what would be removed.
   */
  prune(apply = true) {
    const { unusedDir } = this.detectDeadCode();
    const removed = [];
    for (const rel of unusedDir) {
      const full = path.join(this.rootDir, rel);
      const base = path.basename(full);
      if (!/^test-mcp-/.test(base)) continue;
      if (!apply) { removed.push(rel); continue; }
      try { fs.rmSync(full, { recursive: true, force: true }); removed.push(rel); } catch {}
    }
    return { removed: apply ? removed : [], wouldRemove: apply ? [] : removed, total: removed.length };
  }

  async runAndPrint() {
    const report = await this.run();
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
}

module.exports = { SelfGuard };

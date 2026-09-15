'use strict';
/**
 * Ops Agent - Continuous monitoring and auto-recovery
 * Checks: GitHub status, Gitee sync, AFDian API, CI/CD health
 */
const { execSync } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../../');

class OpsAgent {
  constructor(memory) {
    this.memory = memory;
    this.lastCheck = null;
    this.alerts = [];
  }

  async check() {
    const results = { timestamp: new Date().toISOString(), checks: {}, alerts: [] };
    results.checks.github = await this._checkGitHub();
    results.checks.gitee = await this._checkGitee();
    results.checks.afdian = await this._checkAfdian();
    results.checks.git = this._checkGit();
    for (const [name, result] of Object.entries(results.checks)) {
      if (result.status === 'error') results.alerts.push({ level: 'error', check: name, message: result.message });
      else if (result.status === 'warning') results.alerts.push({ level: 'warning', check: name, message: result.message });
    }
    this.alerts = results.alerts;
    this.lastCheck = results;
    return results;
  }

  async _checkGitHub() {
    try {
      const resp = await this._httpGet('api.github.com/repos/Zeon7744/tri-link-test');
      const data = JSON.parse(resp);
      return { status: 'ok', stars: data.stargazers_count, forks: data.forks_count, updated: data.updated_at, message: `Stars: ${data.stargazers_count}` };
    } catch (err) { return { status: 'error', message: `GitHub error: ${err.message}` }; }
  }

  async _checkGitee() {
    try {
      const resp = await this._httpGet('gitee.com/api/v5/repos/Zeon7744/tri-link-test');
      const data = JSON.parse(resp);
      return { status: 'ok', stars: data.stargazers_count, forks: data.forks_count, message: 'Gitee mirror OK' };
    } catch (err) { return { status: 'warning', message: `Gitee check failed: ${err.message}` }; }
  }

  async _checkAfdian() {
    try {
      const config = this._loadAfdianConfig();
      if (!config) return { status: 'warning', message: 'No AFDian config found' };
      const crypto = require('crypto');
      const ts = Math.floor(Date.now() / 1000);
      const raw = `${config.token}params{}ts${ts}user_id${config.user_id}`;
      const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
      const body = JSON.stringify({ user_id: config.user_id, params: '{}', ts, sign });
      const resp = await this._httpPost(`${config.api_base}/query-sponsor`, body);
      const data = JSON.parse(resp);
      if (data.ec === 200) return { status: 'ok', message: 'AFDian API OK' };
      return { status: 'warning', message: `AFDian error: ec=${data.ec}` };
    } catch (err) { return { status: 'error', message: `AFDian check failed: ${err.message}` }; }
  }

  _checkGit() {
    try {
      const branch = execSync('git branch --show-current', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
      let ahead = 0;
      try { ahead = parseInt(execSync('git rev-list --count HEAD..origin/main', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'pipe' }).trim()) || 0; } catch {}
      return { status: ahead > 0 ? 'warning' : 'ok', branch, ahead, message: ahead > 0 ? `${ahead} commits ahead` : 'In sync' };
    } catch { return { status: 'warning', message: 'Git check skipped' }; }
  }

  _httpGet(hostPath) {
    return new Promise((resolve, reject) => {
      const url = new URL(`https://${hostPath}`);
      const req = https.request(url, { headers: { 'User-Agent': 'tri-link-agent/1.0' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  _httpPost(url, body) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options = { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'tri-link-agent/1.0' } };
      const req = https.request(options, (res) => { let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data)); });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(body); req.end();
    });
  }

  _loadAfdianConfig() {
    try {
      const home = process.env.HOME || process.env.USERPROFILE;
      const cfgPath = path.join(home, '.local', 'bin', 'afdian-link-config.json');
      if (fs.existsSync(cfgPath)) return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch {}
    return null;
  }

  async autoFix(alert) {
    if (alert.check === 'git' && alert.message.includes('ahead')) {
      try { execSync('git push origin main', { cwd: PROJECT_ROOT, stdio: 'pipe' }); return { fixed: true, action: 'pushed to origin' }; } catch {}
    }
    return { fixed: false, action: null };
  }
}

module.exports = { OpsAgent };

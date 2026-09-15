#!/usr/bin/env node
'use strict';

/**
 * Tri-Link Dashboard API Server
 * Aggregates GitHub + AFDian sponsorship statistics
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Config ---
function loadConfig() {
  const paths = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'share', 'afdian-mcp', 'config.json'),
    path.join(process.cwd(), 'config.json'),
  ];
  for (const cfgPath of paths) {
    if (fs.existsSync(cfgPath)) return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
  const fallback = path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'afdian-link-config.json');
  if (fs.existsSync(fallback)) return JSON.parse(fs.readFileSync(fallback, 'utf8'));
  return null;
}

// --- GitHub API ---
function fetchGitHubStats() {
  return new Promise((resolve) => {
    https.get('https://api.github.com/repos/Zeon7744/tri-link-test', {
      headers: { 'User-Agent': 'tri-link-dashboard/1.0', 'Accept': 'application/vnd.github.v3+json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          resolve({ stars: d.stargazers_count, forks: d.forks_count, issues: d.open_issues_count, lang: d.language, updated: d.updated_at });
        } catch { resolve({ stars: null, forks: null, issues: null, lang: null, updated: null }); }
      });
    }).on('error', () => resolve({ stars: null, forks: null, issues: null, lang: null, updated: null }));
  });
}

// --- AFDian API ---
function fetchAfdianStats(config) {
  return new Promise((resolve) => {
    if (!config) return resolve({ sponsors: 0, monthly: 0, recentSponsors: [] });
    try {
      const crypto = require('crypto');
      const ts = Math.floor(Date.now() / 1000);
      const raw = `${config.token}params{}ts${ts}user_id${config.user_id}`;
      const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
      const body = JSON.stringify({ user_id: config.user_id, params: '{}', ts, sign });
      const parsed = new URL(config.api_base || 'https://afdian.com');
      const req = https.request({
        hostname: parsed.hostname, path: '/api/open/query-sponsor', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'tri-link-dashboard/1.0' }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const d = JSON.parse(data);
            if (d.ec === 200 && d.data && d.data.list) {
              resolve({
                sponsors: d.data.total_count || d.data.list.length,
                monthly: d.data.monthly_income || 0,
                recentSponsors: (d.data.list || []).slice(0, 10).map(s => ({ name: s.author, amount: s.amount, time: s.time })),
              });
            } else {
              resolve({ sponsors: 0, monthly: 0, recentSponsors: [], error: d.msg || 'unknown' });
            }
          } catch { resolve({ sponsors: 0, monthly: 0, recentSponsors: [] }); }
        });
      });
      req.on('error', () => resolve({ sponsors: 0, monthly: 0, recentSponsors: [] }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ sponsors: 0, monthly: 0, recentSponsors: [] }); });
      req.write(body); req.end();
    } catch { resolve({ sponsors: 0, monthly: 0, recentSponsors: [] }); }
  });
}

// --- Server ---
const config = loadConfig();
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/stats' && req.method === 'GET') {
    const [gh, af] = await Promise.all([
      fetchGitHubStats(),
      fetchAfdianStats(config),
    ]);
    const body = JSON.stringify({
      ...af,
      githubStars: gh.stars,
      githubForks: gh.forks,
      githubLang: gh.lang,
      githubUpdated: gh.updated,
      lastUpdated: new Date().toISOString(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
    return;
  }

  if (req.url === '/api/sponsors' && req.method === 'GET') {
    const af = await fetchAfdianStats(config);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ sponsors: af.recentSponsors || [], total: af.sponsors || 0 }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Tri-Link Dashboard running at http://localhost:${PORT}`);
  if (config) {
    console.log(`  AFDian user: ${config.creator_page || config.user_id}`);
  } else {
    console.log('  WARNING: No AFDian config found. Stats will show defaults.');
  }
});

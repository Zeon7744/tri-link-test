#!/usr/bin/env node
'use strict';

/**
 * Tri-Link Dashboard API Server
 * Serves data from AFDian + GitHub APIs
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Config ---
function loadConfig() {
  const paths = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'share', 'afdian-mcp', 'config.json'),
    path.join(process.cwd(), 'config.json'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  // Fallback
  const fallback = path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'afdian-link-config.json');
  if (fs.existsSync(fallback)) return JSON.parse(fs.readFileSync(fallback, 'utf8'));
  return null;
}

// --- GitHub API ---
async function fetchGitHubStats() {
  try {
    const resp = await fetch('https://api.github.com/repos/Zeon7744/tri-link-test');
    const data = await resp.json();
    return {
      stars: data.stargazers_count,
      forks: data.forks_count,
      updated: data.updated_at,
    };
  } catch {
    return { stars: null, forks: null, updated: null };
  }
}

// --- AFDian API ---
async function fetchAfdianStats(config) {
  if (!config) return { sponsors: 0, monthly: 0 };
  try {
    const query = new URLSearchParams({ user_id: config.user_id, token: config.token });
    const resp = await fetch(`${config.api_base}/sponsor/stats?${query}`);
    const data = await resp.json();
    return {
      sponsors: data.data?.total_count || 0,
      monthly: data.data?.monthly_amount || 0,
    };
  } catch {
    return { sponsors: 0, monthly: 0 };
  }
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
      lastUpdated: new Date().toISOString(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
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

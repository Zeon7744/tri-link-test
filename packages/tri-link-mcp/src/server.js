'use strict';
/**
 * Tri-Link MCP - Unified MCP server for GitHub + Gitee + AFDian
 *
 * Tools:
 *   GitHub:
 *   - get_repo_stats: repository stats (stars, forks, issues)
 *   - list_issues: open issues list
 *   - search_repos: search GitHub repos
 *   Gitee:
 *   - gitee_repo_info: Gitee repo metadata
 *   AFDian:
 *   - afdian_creator_info: creator profile
 *   - afdian_sponsor_stats: sponsorship statistics
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const https = require('https');

const GITHUB_USER = process.env.GITHUB_USER || 'Zeon7744';
const GITHUB_REPO = process.env.GITHUB_REPO || 'tri-link-test';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITEE_USER = process.env.GITEE_USER || 'Zeon7744';
const GITEE_TOKEN = process.env.GITEE_TOKEN || '';
const AFDIAN_USER = process.env.AFDIAN_USER || 'Zeon7744';
const AFDIAN_TOKEN = process.env.AFDIAN_TOKEN || '';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'tri-link-mcp/1.0', Accept: 'application/json', ...headers },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: null, raw: data }); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function ghPath(reqPath) {
  const headers = { 'User-Agent': 'tri-link-mcp/1.0', 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) headers.Authorization = 'token ' + GITHUB_TOKEN;
  return httpGet('https://api.github.com' + reqPath, headers);
}

function giteePath(reqPath) {
  const headers = { 'User-Agent': 'tri-link-mcp/1.0' };
  if (GITEE_TOKEN) headers['Authorization'] = 'Bearer ' + GITEE_TOKEN;
  return httpGet('https://gitee.com/api/v5' + reqPath, headers);
}

function afdianPath(reqPath) {
  const headers = { 'User-Agent': 'tri-link-mcp/1.0', 'Referer': 'https://afdian.com' };
  if (AFDIAN_TOKEN) headers['Authorization'] = 'Bearer ' + AFDIAN_TOKEN;
  return httpGet('https://afdian.com' + reqPath, headers);
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_repo_stats',
    description: 'Get GitHub repository statistics (stars, forks, open issues)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub owner (defaults to GITHUB_USER env)' },
        repo:  { type: 'string', description: 'Repository name (defaults to GITHUB_REPO env)' },
      },
    },
  },
  {
    name: 'list_issues',
    description: 'List open issues in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo:  { type: 'string' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: 'search_repos',
    description: 'Search GitHub repositories by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        sort:  { type: 'string', enum: ['stars', 'forks', 'helpful-reviews', 'updated'], default: 'stars' },
        limit: { type: 'integer', default: 5, minimum: 1, maximum: 50 },
      },
      required: ['query'],
    },
  },
  {
    name: 'gitee_repo_info',
    description: 'Get Gitee repository metadata (stars, forks, description)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Gitee owner (defaults to GITEE_USER env)' },
        repo:  { type: 'string', description: 'Repository name' },
      },
    },
  },
  {
    name: 'afdian_creator_info',
    description: 'Get AFDian creator profile info (username, page URL)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afdian_sponsor_stats',
    description: 'Get AFDian sponsorship statistics (total sponsors, monthly income)',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleTool(name, args) {
  switch (name) {

    // GitHub tools
    case 'get_repo_stats': {
      const owner = args.owner || GITHUB_USER;
      const repo  = args.repo  || GITHUB_REPO;
      const res = await ghPath(`/repos/${owner}/${repo}`);
      if (res.status !== 200 || !res.body) return { error: 'GitHub API returned HTTP ' + res.status };
      return {
        owner,
        repo,
        stars: res.body.stargazers_count,
        forks: res.body.forks_count,
        open_issues: res.body.open_issues_count,
        description: res.body.description,
        html_url: res.body.html_url,
        updated: res.body.updated_at,
      };
    }

    case 'list_issues': {
      const owner = args.owner || GITHUB_USER;
      const repo  = args.repo  || GITHUB_REPO;
      const state = args.state || 'open';
      const limit = Math.min(args.limit || 10, 100);
      const res = await ghPath(`/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`);
      if (res.status !== 200 || !Array.isArray(res.body)) return { error: 'GitHub API returned HTTP ' + res.status };
      return res.body.map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        user: i.user?.login,
        created_at: i.created_at,
        url: i.html_url,
      }));
    }

    case 'search_repos': {
      const query = encodeURIComponent(args.query);
      const sort  = args.sort || 'stars';
      const limit = Math.min(args.limit || 5, 50);
      const res = await ghPath(`/search/repositories?q=${query}&sort=${sort}&per_page=${limit}`);
      if (res.status !== 200 || !res.body?.items) return { error: 'GitHub search returned HTTP ' + res.status };
      return res.body.items.map((r) => ({
        full_name: r.full_name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        description: r.description,
        html_url: r.html_url,
        language: r.language,
      }));
    }

    // Gitee tools
    case 'gitee_repo_info': {
      const owner = args.owner || GITEE_USER;
      const repo  = args.repo  || GITHUB_REPO;
      if (!repo) return { error: 'repo name required for gitee_repo_info' };
      const res = await giteePath(`/repos/${owner}/${repo}`);
      if (res.status !== 200 || !res.body) return { error: 'Gitee API returned HTTP ' + res.status };
      return {
        owner,
        repo,
        stars: res.body.stars_count,
        forks: res.body.forks_count,
        description: res.body.description,
        html_url: res.body.html_url,
        updated: res.body.updated_at,
      };
    }

    // AFDian tools
    case 'afdian_creator_info': {
      const res = await afdianPath(`/a/${AFDIAN_USER}`);
      if (res.status !== 200) return { error: 'AFDian page fetch returned HTTP ' + res.status };
      return {
        user: AFDIAN_USER,
        page_url: `https://afdian.com/a/${AFDIAN_USER}`,
        status: res.status,
        note: 'Use AFDIAN_TOKEN for API stats',
      };
    }

    case 'afdian_sponsor_stats': {
      if (!AFDIAN_TOKEN) return { error: 'AFDIAN_TOKEN not set - cannot fetch API stats' };
      const res = await afdianPath(`/api/sponsor/get_sponsor_stats`);
      if (res.status !== 200 || res.body?.ec !== 200) return { error: 'AFDian API returned HTTP ' + res.status + ' ec=' + (res.body?.ec || 'n/a') };
      return {
        user: AFDIAN_USER,
        total_sponsors: res.body.data?.total_sponsors,
        monthly_income: res.body.data?.monthly_income,
        raw: res.body.data,
      };
    }

    default:
      return { error: 'Unknown tool: ' + name };
  }
}

// ─── MCP server ──────────────────────────────────────────────────────────────

async function main() {
  const server = new Server(
    { name: 'tri-link-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleTool(name, args || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('tri-link-mcp server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

module.exports = { TOOLS, handleTool, main };

'use strict';
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const https = require('https');

const GITHUB_USER = process.env.GITHUB_USER || 'Zeon7744';
const GITHUB_REPO = process.env.GITHUB_REPO || 'tri-link-test';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const server = new Server({ name: 'github-api-v2', version: '1.0.0' }, {
  capabilities: { tools: {} },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_repo_stats',
      description: 'Get GitHub repository statistics (stars, forks, issues)',
      inputSchema: {
        type: 'object',
        properties: { owner: { type: 'string' }, repo: { type: 'string' } },
        required: [],
      },
    },
    {
      name: 'list_issues',
      description: 'List open issues in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          state: { type: 'string', default: 'open' },
        },
        required: [],
      },
    },
    {
      name: 'search_repos',
      description: 'Search GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, sort: { type: 'string', default: 'stars' } },
        required: ['query'],
      },
    },
  ],
}));

function ghRequest(reqPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: reqPath,
      headers: {
        'User-Agent': 'github-api-v2-agent/1.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    if (GITHUB_TOKEN) options.headers.Authorization = 'token ' + GITHUB_TOKEN;
    https
      .get(options, (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            resolve(data);
          }
        });
      })
      .on('error', reject);
  });
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: args } = request.params;
  const owner = args.owner || GITHUB_USER;
  const repo = args.repo || GITHUB_REPO;

  if (toolName === 'get_repo_stats') {
    const data = await ghRequest('/repos/' + owner + '/' + repo);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              stars: data.stargazers_count,
              forks: data.forks_count,
              issues: data.open_issues_count,
              lang: data.language,
              updated: data.updated_at,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (toolName === 'list_issues') {
    const data = await ghRequest('/repos/' + owner + '/' + repo + '/issues?state=' + (args.state || 'open') + '&per_page=10');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            (Array.isArray(data) ? data : []).map((item) => ({
              number: item.number,
              title: item.title,
              state: item.state,
              created: item.created_at,
            })),
            null,
            2,
          ),
        },
      ],
    };
  }

  if (toolName === 'search_repos') {
    const data = await ghRequest('/search/repositories?q=' + encodeURIComponent(args.query) + '&sort=' + (args.sort || 'stars') + '&per_page=5');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            (data.items || []).map((item) => ({
              name: item.full_name,
              stars: item.stargazers_count,
              lang: item.language,
            })),
            null,
            2,
          ),
        },
      ],
    };
  }

  throw new Error('Unknown tool: ' + toolName);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('github-api-v2 MCP server running on stdio');
}

main().catch(console.error);

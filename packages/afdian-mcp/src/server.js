#!/usr/bin/env node
'use strict';
/**
 * AFDian MCP Server - Model Context Protocol server for AFDian (爱发电) API
 *
 * Tools:
 *   - get_creator_info: Creator profile info
 *   - list_sponsors: Recent sponsors list
 *   - get_sponsor_stats: Sponsor statistics
 *   - get_sponsor_history: User sponsorship history
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { AfdianClient } = require('./client');

function loadConfig() {
  const fs = require('fs');
  const path = require('path');
  const candidates = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'share', 'afdian-mcp', 'config.json'),
    path.join(process.cwd(), 'config.json'),
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'afdian-link-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {} }
  }
  throw new Error('Config not found. Expected ~/.local/share/afdian-mcp/config.json or ~/.local/bin/afdian-link-config.json');
}

const TOOLS = [
  {
    name: 'get_creator_info',
    description: 'Get AFDian creator profile info (username, page URL, follower count)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_sponsors',
    description: 'Get recent sponsors list with usernames, avatars, cumulative amounts',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Number of sponsors (1-100, default 20)', default: 20, minimum: 1, maximum: 100 },
        page: { type: 'integer', description: 'Page number (default 1)', default: 1 },
      },
    },
  },
  {
    name: 'get_sponsor_stats',
    description: 'Get sponsorship statistics (total count, monthly income trend)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_sponsor_history',
    description: 'Get sponsorship history for a specific user by user_id',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'AFDian user ID' },
        limit: { type: 'integer', description: 'Number of records (default 20)', default: 20 },
      },
      required: ['user_id'],
    },
  },
];

async function main() {
  const config = loadConfig();
  const client = new AfdianClient(config);
  const server = new Server({ name: 'afdian-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      let result;
      switch (name) {
        case 'get_creator_info':    result = await client.getCreatorInfo(); break;
        case 'list_sponsors':       result = await client.listSponsors(args.limit, args.page); break;
        case 'get_sponsor_stats':   result = await client.getSponsorStats(); break;
        case 'get_sponsor_history': result = await client.getSponsorHistory(args.user_id, args.limit); break;
        default: throw new Error(`Unknown tool: ${name}`);
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AFDian MCP server running on stdio');
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });

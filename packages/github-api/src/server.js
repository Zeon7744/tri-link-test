'use strict';
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const server = new Server({ name: 'github-api', version: '1.0.0' }, {
  capabilities: { tools: {} },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_items',
      description: 'List items from github-api',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'list_items') {
    return { content: [{ type: 'text', text: JSON.stringify({ items: [] }, null, 2) }]; }
  }
  throw new Error('Unknown tool: ' + name);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('github-api MCP server running on stdio');
}

main().catch(console.error);

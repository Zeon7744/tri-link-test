'use strict';
/**
 * CodeGen - Template-based file generation
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');

class CodeGen {
  constructor() {}

  /**
   * Generate an MCP server package from template
   */
  generateMCPServer(name, config = {}) {
    const dir = path.join(PROJECT_ROOT, 'packages', name);
    if (fs.existsSync(dir)) return { success: false, message: 'Package already exists' };

    // Create directory structure
    const dirs = ['src', 'bin', 'test'];
    dirs.forEach(d => fs.mkdirSync(path.join(dir, d), { recursive: true }));

    // package.json
    const pkg = {
      name: '@tri-link/' + name,
      version: '1.0.0',
      description: config.description || name + ' MCP server',
      main: 'src/server.js',
      bin: { [name]: 'bin/server.js' },
      scripts: { start: 'node bin/server.js', test: 'node test/index.js' },
      dependencies: { '@modelcontextprotocol/sdk': '^1.0.0', zod: '^3.23.0' },
      ...config.pkgExtra,
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));

    // src/server.js template
    const serverTpl = `'use strict';
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const server = new Server({ name: '${name}', version: '1.0.0' }, {
  capabilities: { tools: {} },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_items',
      description: 'List items from ${name}',
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
  console.error('${name} MCP server running on stdio');
}

main().catch(console.error);
`;
    fs.writeFileSync(path.join(dir, 'src', 'server.js'), serverTpl);

    // bin/server.js
    const binTpl = `#!/usr/bin/env node
require('../src/server.js');
`;
    fs.writeFileSync(path.join(dir, 'bin', 'server.js'), binTpl);

    // test/index.js
    const testTpl = `'use strict';
const assert = require('assert');
// TODO: Add integration tests
console.log('${name} tests placeholder');
`;
    fs.writeFileSync(path.join(dir, 'test', 'index.js'), testTpl);

    // README.md
    const readmeTpl = `# ${name} MCP Server

${config.description || name + ' MCP server'}

## Usage

\`\`\`json
{
  "mcpServers": {
    "${name}": {
      "command": "node",
      "args": ["packages/${name}/bin/server.js"]
    }
  }
}
\`\`\`

## Development

\`\`\`bash
cd packages/${name}
npm install
npm test
\`\`\`
`;
    fs.writeFileSync(path.join(dir, 'README.md'), readmeTpl);

    return { success: true, path: dir };
  }

  /**
   * Generate a dashboard widget component
   */
  generateDashboardWidget(widgetName, config = {}) {
    const srcDir = path.join(PROJECT_ROOT, 'packages', 'dashboard', 'src');
    if (!fs.existsSync(srcDir)) return { success: false, message: 'Dashboard not found' };

    const componentTpl = `<template>
  <div class="widget-${widgetName}">
    <h3>${config.title || widgetName}</h3>
    <p>${config.description || ''}</p>
  </div>
</template>

<script setup>
// TODO: Add widget logic
</script>

<style scoped>
.widget-${widgetName} {
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
}
</style>
`;
    const filePath = path.join(srcDir, `${widgetName}.vue`);
    fs.writeFileSync(filePath, componentTpl);
    return { success: true, path: filePath };
  }
}

module.exports = { CodeGen };

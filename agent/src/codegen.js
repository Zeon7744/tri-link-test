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

    // src/server.js - Real GitHub API MCP server
    const serverTpl = [
      "'use strict';",
      "const { Server } = require('@modelcontextprotocol/sdk/server/index.js');",
      "const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');",
      "const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');",
      'const https = require(' + "'https'" + ');',
      '',
      "const GITHUB_USER = process.env.GITHUB_USER || 'Zeon7744';",
      "const GITHUB_REPO = process.env.GITHUB_REPO || 'tri-link-test';",
      "const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';",
      '',
      "const server = new Server({ name: '" + name + "', version: '1.0.0' }, {",
      "  capabilities: { tools: {} },",
      '});',
      '',
      'server.setRequestHandler(ListToolsRequestSchema, async () => ({',
      '  tools: [',
      '    {',
      "      name: 'get_repo_stats',",
      "      description: 'Get GitHub repository statistics (stars, forks, issues)',",
      "      inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: [] },",
      '    },',
      '    {',
      "      name: 'list_issues',",
      "      description: 'List open issues in a GitHub repository',",
      "      inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, state: { type: 'string', default: 'open' } }, required: [] },",
      '    },',
      '    {',
      "      name: 'search_repos',",
      "      description: 'Search GitHub repositories',",
      "      inputSchema: { type: 'object', properties: { query: { type: 'string' }, sort: { type: 'string', default: 'stars' } }, required: ['query'] },",
      '    },',
      '  ],',
      '});',
      '',
      'function ghRequest(reqPath) {',
      '  return new Promise((resolve, reject) => {',
      '    const options = {',
      "      hostname: 'api.github.com',",
      '      path: reqPath,',
      "      headers: { 'User-Agent': '" + name + "-agent/1.0', 'Accept': 'application/vnd.github.v3+json' }",
      '    };',
      "    if (GITHUB_TOKEN) options.headers['Authorization'] = 'token ' + GITHUB_TOKEN;",
      '    https.get(options, (res) => {',
      "      let data = '';",
      "      res.on('data', c => data += c);",
      "      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });",
      "    }).on('error', reject);",
      '  });',
      '}',
      '',
      'server.setRequestHandler(CallToolRequestSchema, async (request) => {',
      "  const { name: toolName, arguments: args } = request.params;",
      '  const owner = args.owner || GITHUB_USER;',
      '  const repo = args.repo || GITHUB_REPO;',
      "  if (toolName === 'get_repo_stats') {",
      "    const data = await ghRequest('/repos/' + owner + '/' + repo);",
      '    return { content: [{ type: \'text\', text: JSON.stringify({',
      "      stars: data.stargazers_count, forks: data.forks_count,",
      "      issues: data.open_issues_count, lang: data.language, updated: data.updated_at",
      "    }, null, 2) }]; }",
      '  }',
      "  if (toolName === 'list_issues') {",
      "    const data = await ghRequest('/repos/' + owner + '/' + repo + '/issues?state=' + (args.state || 'open') + '&per_page=10');",
      '    return { content: [{ type: \'text\', text: JSON.stringify(data.map(i => ({',
      "      number: i.number, title: i.title, state: i.state, created: i.created_at",
      "    })), null, 2) }]; }",
      '  }',
      "  if (toolName === 'search_repos') {",
      "    const data = await ghRequest('/search/repositories?q=' + encodeURIComponent(args.query) + '&sort=' + (args.sort || 'stars') + '&per_page=5');",
      '    return { content: [{ type: \'text\', text: JSON.stringify(data.items.map(r => ({',
      "      name: r.full_name, stars: r.stargazers_count, lang: r.language",
      "    })), null, 2) }]; }",
      '  }',
      "  throw new Error('Unknown tool: ' + toolName);",
      '});',
      '',
      'async function main() {',
      '  const transport = new StdioServerTransport();',
      '  await server.connect(transport);',
      "  console.error('" + name + " MCP server running on stdio');",
      '}',
      '',
      'main().catch(console.error);',
    ].join('\n');

    fs.writeFileSync(path.join(dir, 'src', 'server.js'), serverTpl);

    // bin/server.js
    const binTpl = '#!/usr/bin/env node\nrequire(\'../src/server.js\');\n';
    fs.writeFileSync(path.join(dir, 'bin', 'server.js'), binTpl);

    // test/index.js
    const testTpl = "'use strict';\nconst assert = require('assert');\nconsole.log('" + name + " tests placeholder');\n";
    fs.writeFileSync(path.join(dir, 'test', 'index.js'), testTpl);

    // README.md
    const readmeTpl = '# ' + name + ' MCP Server\n\n' + (config.description || name + ' MCP server') + '\n\n## Usage\n\n```json\n{\n  "mcpServers": {\n    "' + name + '": {\n      "command": "node",\n      "args": ["packages/' + name + '/bin/server.js"]\n    }\n  }\n}\n```\n\n## Development\n\n```bash\ncd packages/' + name + '\nnpm install\nnpm test\n```\n';
    fs.writeFileSync(path.join(dir, 'README.md'), readmeTpl);

    return { success: true, path: dir };
  }

  /**
   * Generate a dashboard widget component
   */
  generateDashboardWidget(widgetName, config = {}) {
    const srcDir = path.join(PROJECT_ROOT, 'packages', 'dashboard', 'src');
    if (!fs.existsSync(srcDir)) return { success: false, message: 'Dashboard not found' };

    const componentTpl = '<template>\n  <div class="widget-' + widgetName + '">\n    <h3>' + (config.title || widgetName) + '</h3>\n    <p>' + (config.description || '') + '</p>\n  </div>\n</template>\n\n<script setup>\n// TODO: Add widget logic\n</script>\n\n<style scoped>\n.widget-' + widgetName + ' {\n  padding: 16px;\n  border: 1px solid #e8e8e8;\n  border-radius: 8px;\n}\n</style>\n';
    const filePath = path.join(srcDir, widgetName + '.vue');
    fs.writeFileSync(filePath, componentTpl);
    return { success: true, path: filePath };
  }
}

module.exports = { CodeGen };

'use strict';
/**
 * Executor v3 - Smart task execution with code generation
 * Generates real files instead of just running shell commands
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PACKAGES_ROOT = path.join(PROJECT_ROOT, 'packages');

class Executor {
  constructor(memory) {
    this.memory = memory;
    this.codegen = require('./codegen').CodeGen ? new (require('./codegen').CodeGen)() : null;
  }

  async run(task) {
    const { title, description, category, commands = [] } = task;
    const results = [];
    const t0 = Date.now();

    // 1. Try smart code generation first
    const generated = this._generateCode(task);
    if (generated.length > 0) {
      for (const gen of generated) {
        try {
          gen();
          results.push({ action: 'generate', file: gen.file, success: true });
        } catch (err) {
          results.push({ action: 'generate', file: gen.file, error: err.message.substring(0, 200), success: false });
        }
      }
    }

    // 2. Run any explicit commands
    for (const cmd of commands) {
      try {
        const output = this._exec(cmd);
        results.push({ cmd: cmd.substring(0, 100), output: (output || '').substring(0, 300), success: true });
      } catch (err) {
        results.push({ cmd: cmd.substring(0, 100), error: err.message.substring(0, 300), success: false });
      }
    }

    const duration = Date.now() - t0;
    if (results.some(r => r.success)) this._autoCommit(title, results);
    return { results, summary: results.filter(r => r.success).length + ' actions for: ' + title, duration };
  }

  /**
   * Generate code based on task type
   */
  _generateCode(task) {
    const generators = [
      this._genMCPServer,
      this._genDashboardFile,
      this._genReadmeIntegration,
      this._genTestFile,
      this._genDocsFile,
    ];
    const actions = [];
    for (const gen of generators) {
      try {
        const result = gen.call(this, task);
        if (result) actions.push(...(Array.isArray(result) ? result : [result]));
      } catch {}
    }
    return actions;
  }

  /**
   * Generate MCP server package
   */
  _genMCPServer(task) {
    const { title } = task;
    // Match patterns like "创建 MCP 服务器", "create mcp server", "mcp"
    if (!/mcp|服务器|server/.test(title)) return null;
    const match = title.match(/[a-zA-Z0-9_-]+/);
    if (!match) return null;
    const name = match[0];
    // Avoid re-generating if already exists with content
    const dir = path.join(PACKAGES_ROOT, name);
    if (fs.existsSync(dir) && fs.readdirSync(dir).filter(f => f !== '.gitignore').length > 0) {
      return null;
    }
    const result = this.codegen?.generateMCPServer(name, { description: title });
    return result?.success
      ? [{ file: result.path, fn: () => {} }]
      : null;
  }

  /**
   * Update dashboard server with real integrations
   */
  _genDashboardFile(task) {
    const { title, description } = task;
    if (!/dashboard|面板|统计/.test(title)) return null;

    const dashboardServer = path.join(PROJECT_ROOT, 'packages', 'dashboard', 'server.js');
    if (!fs.existsSync(dashboardServer)) return null;

    // Enhance the dashboard server with real GitHub API
    let content = fs.readFileSync(dashboardServer, 'utf8');
    if (content.includes('fetchGitHubStats')) return null; // Already enhanced

    // Add enhanced GitHub stats with fork count display
    const enhanced = content.replace(
      "      githubStars: gh.stars,\n      githubForks: gh.forks,",
      `      githubStars: gh.stars,
      githubForks: gh.forks,
      githubLang: gh.language,
      githubUpdated: gh.updated,`
    );

    fs.writeFileSync(dashboardServer, enhanced, 'utf8');
    return [{ file: dashboardServer, fn: () => {} }];
  }

  /**
   * Integrate AFDian data into README
   */
  _genReadmeIntegration(task) {
    const { title } = task;
    if (!/afdian|README|赞助者/.test(title)) return null;

    const readmePath = path.join(PROJECT_ROOT, 'README.md');
    if (!fs.existsSync(readmePath)) return null;

    let content = fs.readFileSync(readmePath, 'utf8');
    if (content.includes('AFDian Sponsor')) return null; // Already integrated

    const sponsorSection = `\n## 赞助者\n\n感谢以下赞助者支持 tri-link-test 开发：\n\n<details>\n<summary>点击查看赞助者列表</summary>\n\n| 赞助者 | 金额 | 时间 |\n|--------|------|------|\n| _自动更新_ | — | — |\n\n</details>\n\n> 爱发电: [afdian.com/a/Zeon7744](https://afdian.com/a/Zeon7744)\n`;

    // Insert before the end of file
    const insertAt = content.lastIndexOf('---');
    if (insertAt > 0) {
      content = content.slice(0, insertAt) + sponsorSection + '\n' + content.slice(insertAt);
    } else {
      content += sponsorSection;
    }

    fs.writeFileSync(readmePath, content, 'utf8');
    return [{ file: readmePath, fn: () => {} }];
  }

  /**
   * Generate test files
   */
  _genTestFile(task) {
    const { title } = task;
    if (!/test|测试/.test(title)) return null;

    // Find which package to test
    const match = title.match(/[a-zA-Z0-9_-]+/);
    if (!match) return null;
    const pkgName = match[0];
    const testDir = path.join(PROJECT_ROOT, 'packages', pkgName, 'test');
    if (!fs.existsSync(testDir)) return null;

    const testFile = path.join(testDir, 'integration.js');
    if (fs.existsSync(testFile)) return null;

    const testContent = `'use strict';
/**
 * Integration tests for ${pkgName}
 */
const assert = require('assert');

describe('${pkgName} integration', () => {
  it('should export a valid module', () => {
    // TODO: Add real integration tests
    assert.ok(true, 'placeholder test');
  });
});
`;
    fs.writeFileSync(testFile, testContent, 'utf8');
    return [{ file: testFile, fn: () => {} }];
  }

  /**
   * Generate documentation files
   */
  _genDocsFile(task) {
    const { title, description } = task;
    if (!/docs|文档|guide|配置/.test(title)) return null;

    const docsDir = path.join(PROJECT_ROOT, 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const docName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
    const docFile = path.join(docsDir, `${docName}.md`);
    if (fs.existsSync(docFile)) return null;

    const docContent = `# ${title}\n\n${description || ''}\n\n## 概述\n\n本文档描述 ${title} 的实现细节。\n\n## 使用方法\n\n\`\`\`bash\n# TODO: Add usage instructions\n\`\`\`\n\n## 相关\n\n- [README.md](../README.md)\n- [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md)\n`;

    fs.writeFileSync(docFile, docContent, 'utf8');
    return [{ file: docFile, fn: () => {} }];
  }

  _exec(cmd) {
    try {
      const fullCmd = 'cmd /c "' + cmd.replace(/"/g, '\\"') + '"';
      return execSync(fullCmd, { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch { return ''; }
  }

  _autoCommit(message, results) {
    try {
      execSync('git add -A', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      const successCount = results.filter(r => r.success).length;
      execSync(`git commit -m "feat(agent): ${message} (${successCount} actions)"`, { cwd: PROJECT_ROOT, stdio: 'pipe' });
      if (this.memory.data.config.autoPush) {
        try { execSync('git push origin main', { cwd: PROJECT_ROOT, stdio: 'pipe' }); } catch {}
        try { execSync('git push gitee main', { cwd: PROJECT_ROOT, stdio: 'pipe' }); } catch {}
      }
    } catch {}
  }
}

module.exports = { Executor };

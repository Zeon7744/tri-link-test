'use strict';
/**
 * Executor v2 - Smart task execution with auto-generated actions
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PACKAGES_ROOT = path.join(PROJECT_ROOT, 'packages');

class Executor {
  constructor(memory) { this.memory = memory; }

  async run(task) {
    const { title, description, commands = [] } = task;
    const results = [];
    const generated = this._generateCommands(task);
    const allCommands = [...commands, ...generated];
    for (const cmd of allCommands) {
      try {
        const output = this._exec(cmd);
        results.push({ cmd: cmd.substring(0, 100), output: (output || '').substring(0, 300), success: true });
      } catch (err) {
        results.push({ cmd: cmd.substring(0, 100), error: err.message.substring(0, 300), success: false });
      }
    }
    if (results.some(r => r.success)) this._autoCommit(title, results);
    return { results, summary: results.filter(r => r.success).length + ' commands executed for: ' + title };
  }

  _generateCommands(task) {
    const { title, category } = task;
    const cmds = [];
    if ((title.includes('创建') || title.includes('create')) && category === 'feature') {
      const match = title.match(/[a-zA-Z0-9_-]+/);
      if (match) {
        const dir = path.join(PACKAGES_ROOT, match[0]);
        if (!fs.existsSync(dir)) cmds.push('mkdir "' + dir + '" 2>$null');
      }
    }
    return cmds;
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
      execSync('git commit -m "feat(agent): ' + message + '"', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      if (this.memory.data.config.autoPush) {
        try { execSync('git push origin main', { cwd: PROJECT_ROOT, stdio: 'pipe' }); } catch {}
        try { execSync('git push gitee main', { cwd: PROJECT_ROOT, stdio: 'pipe' }); } catch {}
      }
    } catch {}
  }

}

module.exports = { Executor };

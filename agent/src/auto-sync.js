'use strict';
/**
 * AutoSync - automatic commit + multi-remote sync for Tri-Link Agent
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');

function gitRun(args, options = {}) {
  const cmd = 'git ' + args;
  try {
    return execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: options.timeoutMs || 60000,
      ...options,
    }).trim();
  } catch (err) {
    const output = (err.stdout?.toString?.() || err.stderr?.toString?.() || err.message || '').trim();
    const error = new Error(output || err.message);
    error.command = cmd;
    error.exitCode = err.code;
    error.stdout = err.stdout?.toString?.() || '';
    error.stderr = err.stderr?.toString?.() || '';
    return error;
  }
}

function isGitError(value) {
  return value instanceof Error;
}

function normalizeGitOutput(output) {
  if (typeof output !== 'string') return String(output || '').trim();
  return output.trim();
}

function summarizeGitError(error) {
  const raw = [
    error?.stdout,
    error?.stderr,
    error?.message,
  ].filter(Boolean).join('\n');
  const compact = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!compact) return 'Unknown git error';
  if (compact.length <= 280) return compact;
  return compact.slice(0, 277) + '...';
}

function summarizeText(text, limit = 220) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (compact.length <= limit) return compact;
  return compact.slice(0, limit - 3) + '...';
}

function uniqueRemoteNames(output) {
  const lines = normalizeGitOutput(output).split(/\r?\n/).filter(Boolean);
  const names = new Set();
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_.-]+)\s+([^\s]+)\s+\((fetch|push)\)$/);
    if (match) names.add(match[1]);
  }
  return Array.from(names);
}

function selectRemotes(allRemotes, preferred) {
  if (!Array.isArray(preferred) || preferred.length === 0) return allRemotes;
  const set = new Set(preferred);
  const matches = allRemotes.filter((name) => set.has(name));
  return matches.length > 0 ? matches : allRemotes;
}

function currentBranch() {
  const output = gitRun('branch --show-current');
  if (isGitError(output)) return 'main';
  return output || 'main';
}

function workingTreeStatus() {
  const output = gitRun('status --porcelain');
  if (isGitError(output)) return [];
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean);
}

function parseStatusLine(line) {
  if (!line) return null;
  const code = line.slice(0, 2);
  // git porcelain output: 2-char status, 1 space, then path
  let filePath = line.slice(3);
  const x = code[0];
  const y = code[1];

  if (x === '?' && y === '?') {
    if (filePath.includes(' -> ')) {
      const [source, target] = filePath.split(' -> ');
      return { type: 'untracked', file: target.trim(), status: 'renamed-untracked' };
    }
    return { type: 'untracked', file: filePath, status: 'new' };
  }

  if (x === 'R' || x === 'C') {
    const [source, target] = filePath.split(' -> ');
    return { type: 'rename', file: target.trim() || filePath, status: x };
  }

  if (x !== ' ' && x !== '?') {
    if (filePath.startsWith('gent/')) filePath = 'agent/' + filePath.slice(5);
    return { type: 'modified', file: filePath, status: x };
  }
  if (y !== ' ' && y !== '?') {
    if (filePath.startsWith('gent/')) filePath = 'agent/' + filePath.slice(5);
    return { type: 'modified', file: filePath, status: y };
  }
  return null;
}

function collectTrackedPaths(statusLines) {
  const files = new Set();
  for (const line of statusLines) {
    const parsed = parseStatusLine(line);
    if (!parsed) continue;
    if (parsed.type === 'untracked') continue;
    if (parsed.file) files.add(parsed.file);
  }
  return Array.from(files);
}

function isAutoSyncFile(filePath) {
  const clean = String(filePath || '').replace(/\\/g, '/');
  const allowed = [
    /^agent\/src\/auto-sync\.(js|ts)$/i,
    /^agent\/src\/agent\.(js|ts)$/i,
    /^agent\/README\.md$/i,
    /^bin\/agent-cli\.js$/i,
    /^package\.json$/i,
    /^CHANGELOG\.md$/i,
  ];
  return allowed.some((re) => re.test(clean));
}

function collectFiles(statusLines, includeUntracked = false) {
  const tracked = collectTrackedPaths(statusLines);
  if (!includeUntracked) return tracked;

  const untracked = new Set();
  for (const line of statusLines) {
    const parsed = parseStatusLine(line);
    if (parsed?.type === 'untracked' && parsed.file) untracked.add(parsed.file);
  }
  return Array.from(new Set([...tracked, ...untracked])).sort();
}

function commitMessageFromFiles(files, fallback) {
  const joined = files.join(', ');
  const message = `feat(agent): enable auto-sync capability (${files.length} file${files.length === 1 ? '' : 's'})`;
  return {
    subject: message,
    body: fallback ? `Scope: ${summarizeText(joined, 180)}` : '',
  };
}

function pushResult(output, remote) {
  const text = normalizeGitOutput(output);
  const successPattern = new RegExp(`To\\s+(?:ssh|https)://[^\\s]+`);
  const upToDate = /Everything up-to-date/i.test(text);
  const rejected = /rejected|failed|error/i.test(text);
  const ok = upToDate || (!rejected && (successPattern.test(text) || text.length === 0));
  return {
    remote,
    ok,
    output: text || 'OK',
  };
}

class AutoSync {
  constructor(memory, options = {}) {
    this.memory = memory;
    this.options = options;
    this.defaultRemotes = ['origin', 'gitee'];
  }

  status() {
    const branch = currentBranch();
    const statusLines = workingTreeStatus();
    const tracked = collectTrackedPaths(statusLines);
    const remotes = uniqueRemoteNames(gitRun('remote -v'));
    const pushTargets = selectRemotes(remotes, this.defaultRemotes);

    const ahead = gitRun(`rev-list --count HEAD..origin/${branch}`);
    const behind = gitRun(`rev-list --count origin/${branch}..HEAD`);

    return {
      branch,
      remotes,
      pushTargets,
      trackedChangedFiles: tracked,
      clean: tracked.length === 0,
      aheadOfOrigin: isGitError(ahead) ? null : parseInt(ahead || '0', 10) || 0,
      behindOrigin: isGitError(behind) ? null : parseInt(behind || '0', 10) || 0,
      config: this.options,
      timestamp: new Date().toISOString(),
    };
  }

  async run(options = {}) {
    const runOptions = { ...this.options, ...options };
    const result = {
      startedAt: new Date().toISOString(),
      completedAt: null,
      success: false,
      commit: null,
      push: [],
      error: null,
    };

    const statusLines = workingTreeStatus();
    let files = collectFiles(statusLines, runOptions.includeUntracked !== false);
    if (files.length === 0) {
      result.success = true;
      result.completedAt = new Date().toISOString();
      result.skipped = 'no changes';
      this._recordRun({ ...result, files });
      return result;
    }

    if (runOptions.dryRun) {
      result.skipped = 'dry-run';
      result.files = files;
      result.completedAt = new Date().toISOString();
      this._recordRun({ ...result, files });
      return result;
    }

    const stageList = runOptions.onlyKnownFiles ? files.filter((file) => isAutoSyncFile(file)) : files;
    if (stageList.length === 0) {
      result.success = true;
      result.skipped = 'no auto-sync related files';
      result.completedAt = new Date().toISOString();
      this._recordRun({ ...result, files });
      return result;
    }

    const staged = gitRun(`add ${stageList.map((file) => JSON.stringify(file)).join(' ')}`);
    if (isGitError(staged)) {
      result.error = summarizeGitError(staged);
      result.completedAt = new Date().toISOString();
      this._recordRun(result);
      return result;
    }

    const stagedOutput = gitRun('diff --cached --name-only');
    const stagedFiles = isGitError(stagedOutput) ? stageList : stagedOutput.split(/\r?\n/).filter(Boolean);
    if (stagedFiles.length === 0) {
      result.success = true;
      result.skipped = 'nothing staged';
      result.completedAt = new Date().toISOString();
      this._recordRun(result);
      return result;
    }

    const message = commitMessageFromFiles(stagedFiles, runOptions.messageFallback || 'auto-sync');
    const commitArgs = runOptions.message
      ? `-m ${JSON.stringify(runOptions.message)} -m ${JSON.stringify(message.body || '')}`
      : `-m ${JSON.stringify(message.subject)}${message.body ? ` -m ${JSON.stringify(message.body)}` : ''}`;
    const commit = gitRun(`commit ${commitArgs}`);
    if (isGitError(commit)) {
      result.error = summarizeGitError(commit);
      result.completedAt = new Date().toISOString();
      this._recordRun(result);
      return result;
    }

    const sha = gitRun('rev-parse HEAD');
    result.commit = {
      sha: isGitError(sha) ? null : sha,
      files: stagedFiles,
      message: message.subject,
    };

    const branch = currentBranch();
    const remotes = uniqueRemoteNames(gitRun('remote -v'));
    const targets = selectRemotes(remotes, runOptions.remotes || this.defaultRemotes);
    for (const remote of targets) {
      const push = gitRun(`push ${remote} ${branch}`, { timeoutMs: 90000 });
      result.push.push(pushResult(push, remote));
    }

    result.success = result.push.every((entry) => entry.ok);
    result.completedAt = new Date().toISOString();
    this._recordRun(result);
    return result;
  }

  _recordRun(payload) {
    if (!this.memory) return;
    try {
      this.memory.addDecision({
        type: 'auto_sync',
        success: Boolean(payload.success),
        skipped: payload.skipped || null,
        commit: payload.commit?.sha || null,
        push: payload.push,
        error: payload.error || null,
        time: new Date().toISOString(),
      });
      this.memory.updateMetrics({
        lastAutoSync: payload.completedAt || new Date().toISOString(),
        lastAutoSyncSuccess: Boolean(payload.success),
      });
    } catch {}
  }
}

module.exports = { AutoSync };

#!/usr/bin/env node
'use strict';

/**
 * Tri-Link DevKit CLI
 * One-command GitHub + Gitee + AFDian project toolkit.
 *
 * Supports user-supplied tokens via CLI flags or environment variables:
 *   GITHUB_TOKEN, GITEE_TOKEN, AFDIAN_TOKEN
 */

const path = require('path');
const { DevKit } = require('../src/index');

// ─── Arg Parsing ───────────────────────────────────────────────────────────────

const USAGE = `
Tri-Link DevKit v1.0.0
GitHub + Gitee + AFDian three-way project toolkit

Commands:
  init <repo> [opts]       Initialize a new tri-link project locally
  create-remote <repo>    Create repos on GitHub/Gitee via API (needs tokens)
  push [branch]           Push current branch to all remotes
  status                  Show sync status
  github-stats [repo]     Fetch GitHub repo stats via API
  afdian-stats            Fetch AFDian sponsorship stats
  mcp-config [dir]        Generate MCP server config
  dashboard [repo] [dir]  Generate standalone dashboard HTML
  help                    Show this help

Global options (or use env vars):
  -g, --github <user>         GitHub username        (env: GITHUB_USER)
  -G, --gitee <user>         Gitee username          (env: GITEE_USER)
  -A, --afdian <user>        AFDian username         (env: AFDIAN_USER)
  -t, --github-token <tok>   GitHub personal token   (env: GITHUB_TOKEN)
  -T, --gitee-token <tok>   Gitee personal token    (env: GITEE_TOKEN)
  -a, --afdian-token <tok>  AFDian API token        (env: AFDIAN_TOKEN)
  -b, --branch <name>        Default branch          (default: main)
  -d, --description <text>   Repo description
  -h, --help                 Show help

Examples:
  # Initialize locally
  node bin/cli.js init my-repo -g myuser -G myuser -A myuser

  # Create remote repos (requires tokens)
  GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx node bin/cli.js create-remote my-repo

  # Push to all remotes
  node bin/cli.js push

  # Generate dashboard
  node bin/cli.js dashboard my-repo -g myuser -A myuser

  # Full pipeline
  GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx AFDIAN_TOKEN=xxx \\
    node bin/cli.js init my-repo -g myuser -G myuser -A myuser \\
  && node bin/cli.js create-remote my-repo \\
  && node bin/cli.js push
`;

function parseArgs(args) {
  const opts = {
    command: args[0] || 'help',
    positional: [],
    githubUser: process.env.GITHUB_USER || '',
    giteeUser: process.env.GITEE_USER || '',
    afdianUser: process.env.AFDIAN_USER || '',
    githubToken: process.env.GITHUB_TOKEN || '',
    giteeToken: process.env.GITEE_TOKEN || '',
    afdianToken: process.env.AFDIAN_TOKEN || '',
    branch: process.env.TRI_BRANCH || 'main',
    description: '',
    targetDir: '',
    help: false,
  };

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    const takeVal = () => {
      i++;
      if (i >= args.length) {
        console.error(`Error: ${arg} requires a value`);
        process.exit(1);
      }
      return args[i];
    };

    switch (arg) {
      case '-g': case '--github':    opts.githubUser  = takeVal(); break;
      case '-G': case '--gitee':     opts.giteeUser   = takeVal(); break;
      case '-A': case '--afdian':    opts.afdianUser  = takeVal(); break;
      case '-t': case '--github-token': opts.githubToken = takeVal(); break;
      case '-T': case '--gitee-token':  opts.giteeToken  = takeVal(); break;
      case '-a': case '--afdian-token': opts.afdianToken = takeVal(); break;
      case '-b': case '--branch':    opts.branch      = takeVal(); break;
      case '-d': case '--description': opts.description = takeVal(); break;
      case '-o': case '--output':    opts.targetDir   = takeVal(); break;
      case '-h': case '--help':      opts.help = true;  break;
      default:
        if (!arg.startsWith('-')) opts.positional.push(arg);
    }
    i++;
  }

  return opts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const devkit = new DevKit(opts);

  switch (opts.command) {
    case 'help':
      console.log(USAGE);
      break;

    case 'init': {
      const repo = opts.positional[0];
      if (!repo) { console.error('Error: repo name required.'); console.log(USAGE); process.exit(1); }
      await devkit.init(repo, opts);
      break;
    }

    case 'create-remote': {
      const repo = opts.positional[0];
      if (!repo) { console.error('Error: repo name required.'); process.exit(1); }
      devkit.repoName = repo;
      await devkit.createRemotes(repo, opts);
      break;
    }

    case 'push': {
      const branch = opts.positional[0] || opts.branch;
      await devkit.push(branch);
      break;
    }

    case 'status': {
      const status = await devkit.status();
      console.log(JSON.stringify(status, null, 2));
      break;
    }

    case 'github-stats': {
      const repo = opts.positional[0] || devkit._repoNameFromGit() || '';
      if (!repo) { console.error('Error: no repo name detected. Provide it as arg or set GITHUB_USER.'); process.exit(1); }
      const stats = await devkit.githubStats(repo);
      if (stats) console.log(JSON.stringify(stats, null, 2));
      break;
    }

    case 'afdian-stats': {
      const stats = await devkit.afdianStats();
      console.log(JSON.stringify(stats, null, 2));
      break;
    }

    case 'mcp-config': {
      const dir = opts.positional[0] || opts.targetDir;
      devkit.mcpConfig({ targetDir: dir ? path.resolve(dir) : undefined });
      break;
    }

    case 'dashboard': {
      const repo = opts.positional[0] || devkit._repoNameFromGit() || '';
      if (!repo) { console.error('Error: no repo name detected.'); process.exit(1); }
      devkit.repoName = repo;
      const dir = opts.positional[1] || opts.targetDir;
      devkit.dashboard({ repoName: repo, outDir: dir ? path.resolve(dir) : undefined });
      break;
    }

    case '':
      console.log(USAGE);
      process.exit(1);

    default:
      console.error(`Unknown command: ${opts.command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Tri-Link DevKit error:', err.message);
  process.exit(1);
});

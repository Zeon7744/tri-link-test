#!/usr/bin/env node
'use strict';
/**
 * tri-link-agent CLI
 *
 * Usage:
 *   node bin/agent-cli.js [command] [options]
 *
 * Commands:
 *   status              Show agent status and task summary
 *   require <text>      Submit a development requirement
 *   run                 Auto-execute all pending tasks
 *   monitor             Monitor open PRs (GitHub)
 *   release [bump]      Trigger release workflow
 *   interactive         Start interactive REPL mode
 *   help                Show this help
 *
 * Options:
 *   --repo <name>       Repo name
 *   --branch <name>     Branch (default: main)
 *   --bump <part>       Release bump: major|minor|patch
 *   --dry-run           No writes, no pushes
 *   -h, --help          Show help
 */

const path = require('path');
const { Agent } = require('../src/agent.js');

// Re-export the existing agent's Agent class for CLI
// The existing agent/src/agent.js has an Agent class with interact(), status(), etc.

const USAGE = `
tri-link-agent v1.0.0
Auto commit, push, PR monitor, and release agent for tri-link projects.

Usage:
  node bin/agent-cli.js <command> [options]

Commands:
  status               Show agent status and task summary
  require <text>       Submit a development requirement and auto-execute
  run                  Auto-execute all pending tasks
  monitor              Monitor open PRs (GitHub API)
  release [bump]       Trigger release: changelog + tag + push
  interactive          Start interactive REPL (type "help" inside)
  help                 Show this help

Options:
  --repo <name>        Repo name (default: detect from git)
  --branch <name>      Branch (default: main)
  --bump <part>        Release bump: major|minor|patch (default: patch)
  --dry-run            No writes, no pushes
  -h, --help           Show help

Environment:
  GITHUB_TOKEN         GitHub personal access token (required for monitor/release)
  GITEE_TOKEN          Gitee personal access token (enables gitee push)
  GITHUB_USER          GitHub username
  TRI_BRANCH           Default branch (default: main)

Examples:
  node bin/agent-cli.js status
  GITHUB_TOKEN=ghp_xxx node bin/agent-cli.js monitor
  GITHUB_TOKEN=ghp_xxx node bin/agent-cli.js release --bump minor
  node bin/agent-cli.js interactive
`;

function parseArgs(argv) {
  const args = {
    command: 'help',
    text: '',
    bump: 'patch',
    dryRun: false,
    help: false,
    positional: [],
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    const takeVal = () => { i++; return argv[i]; };
    switch (arg) {
      case '--repo':    args.repo    = takeVal(); break;
      case '--branch':  args.branch  = takeVal(); break;
      case '--bump':    args.bump    = takeVal(); break;
      case '--dry-run': args.dryRun  = true; break;
      case '-h': case '--help': args.help = true; break;
      default:
        if (!arg.startsWith('-')) args.positional.push(arg);
    }
    i++;
  }
  if (args.positional.length > 0) {
    const cmd = args.positional[0];
    if (['status', 'require', 'run', 'monitor', 'release', 'interactive', 'help'].includes(cmd)) {
      args.command = cmd;
      if (cmd === 'require') args.text = args.positional.slice(1).join(' ');
    } else {
      args.positional.unshift('help');
      args.command = 'help';
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const agentOpts = {
    rootDir: path.join(__dirname, '..', '..'),
    repoName: args.repo || '',
    branch: args.branch || process.env.TRI_BRANCH || 'main',
    githubToken: process.env.GITHUB_TOKEN || '',
    giteeToken: process.env.GITEE_TOKEN || '',
    dryRun: args.dryRun,
  };

  switch (args.command) {
    case 'status': {
      const { Agent: FullAgent } = require('../src/agent.js');
      const agent = new FullAgent(agentOpts);
      agent.status();
      break;
    }
    case 'require': {
      if (!args.text) {
        console.error('Usage: require <text>');
        process.exit(1);
      }
      const { Agent: FullAgent } = require('../src/agent.js');
      const agent = new FullAgent(agentOpts);
      agent.require(args.text, { autoExecute: !args.dryRun });
      break;
    }
    case 'run': {
      const { Agent: FullAgent } = require('../src/agent.js');
      const agent = new FullAgent(agentOpts);
      await agent.runAll();
      break;
    }
    case 'monitor': {
      // Use the simple Agent from packages/tri-link-agent for PR monitoring
      const { Agent: SimpleAgent } = require('../src/agent.js');
      const agent = new SimpleAgent(agentOpts);
      const result = await agent.monitorPRs();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'release': {
      const { Agent: SimpleAgent } = require('../src/agent.js');
      const agent = new SimpleAgent(agentOpts);
      const result = await agent.release({ bump: args.bump, dryRun: args.dryRun });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'interactive': {
      const { Agent: FullAgent } = require('../src/agent.js');
      const agent = new FullAgent(agentOpts);
      await agent.interact();
      break;
    }
    case 'help':
    default: {
      console.log(USAGE);
      break;
    }
  }
}

main().catch((err) => {
  console.error('tri-link-agent error:', err.message);
  process.exit(1);
});

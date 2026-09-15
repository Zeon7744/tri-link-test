'use strict';

/**
 * Tri-Link Autonomous Agent
 * Core loop: Receive requirement → Parse → Plan → Execute → Monitor → Feedback
 */

const { Memory } = require('./memory');
const { Planner } = require('./planner');
const { Executor } = require('./executor');
const { OpsAgent } = require('./ops');
const fs = require('fs');
const path = require('path');

// ANSI colors
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  white: '\x1b[37m', gray: '\x1b[90m',
};

function log(color, ...args) {
  console.log(`${C[color] || ''}${args.join(' ')}${C.reset}`);
}

class Agent {
  constructor(options = {}) {
    this.memory = new Memory(options.memoryPath);
    this.planner = new Planner(this.memory);
    this.executor = new Executor(this.memory);
    this.ops = new OpsAgent(this.memory);
    this.running = false;
    this.conversationHistory = [];
  }

  // ── Status ──────────────────────────────────────────────
  status() {
    const summary = this.memory.getSummary();
    log('cyan', '\n╔══════════════════════════════════════════╗');
    log('cyan', '║       Tri-Link Agent v1.0.0              ║');
    log('cyan', '╚══════════════════════════════════════════╝');
    log('white', `\n📊 项目状态:`);
    log('  ', `   活跃任务: ${summary.activeTasks}`);
    log('  ', `   已完成: ${summary.completedTasks}`);
    log('  ', `   当前计划: ${summary.activePlan}`);
    log('  ', `   GitHub Stars: ${summary.metrics.stars}`);
    log('  ', `   赞助者: ${summary.metrics.afdianSponsors}`);
    log('  ', `   月收入: ¥${summary.metrics.monthlyIncome}`);
    log('  ', `   博客文章: ${summary.metrics.blogPosts}`);

    if (this.memory.data.tasks.length > 0) {
      log('yellow', '\n⏳ 待处理任务:');
      this.memory.data.tasks.slice(0, 5).forEach(t => {
        log('  ', `  • [${t.priority}] ${t.title}`);
      });
    } else {
      log('green', '\n✨ 所有任务已完成，等待新需求');
    }
    log('');
  }

  // ── Require ─────────────────────────────────────────────
  require(requirement, options = {}) {
    log('magenta', `\n🤖 收到需求: "${requirement}"`);
    log('dim', `   分析中...`);

    const plan = this.planner.createPlan(requirement, options);
    log('green', `   ✅ 规划完成: ${plan.tasks.length} 个任务`);

    // Log tasks
    plan.tasks.forEach((t, i) => {
      const prio = t.priority === 'critical' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'medium' ? '🟡' : '🟢';
      log('  ', `   ${prio} [${i + 1}] ${t.title} (${t.estimate})`);
    });

    // Auto-execute if flag set
    if (options.autoExecute !== false) {
      this.executeNext();
    }

    return plan;
  }

  // ── Execute ─────────────────────────────────────────────
  async executeNext() {
    const task = this.planner.getNextTask();
    if (!task) {
      log('green', '✨ 无待执行任务');
      return null;
    }

    log('blue', `\n▶ 执行: ${task.title}`);
    this.memory.set('agentState', {
      mode: 'executing',
      currentTask: task.id,
      conversationHistory: this.conversationHistory,
      lastAction: 'execute',
      lastActionTime: new Date().toISOString(),
    });

    try {
      const result = await this.executor.run(task);
      this.memory.completeTask(task.id, result);
      log('green', `   ✅ 完成: ${task.title}`);
      this.memory.updateMetrics({ totalCommits: (this.memory.data.metrics.totalCommits || 0) + 1 });
    } catch (err) {
      log('red', `   ❌ 失败: ${task.title} - ${err.message}`);
      // Retry or mark failed
      task.status = 'failed';
      task.error = err.message;
      this.memory.addDecision({
        type: 'task_failed',
        taskId: task.id,
        error: err.message,
        action: 'retry',
      });
    }

    this.memory.set('agentState', {
      mode: 'idle',
      currentTask: null,
      conversationHistory: this.conversationHistory,
      lastAction: 'completed',
      lastActionTime: new Date().toISOString(),
    });

    // Continue with next task
    const next = this.planner.getNextTask();
    if (next) {
      log('dim', `   → 下一个: ${next.title}`);
      return this.executeNext();
    }
    return null;
  }

  // ── Auto-run all pending tasks ──────────────────────────
  async runAll() {
    log('cyan', '\n🚀 开始自动执行所有待处理任务...\n');
    this.running = true;
    while (this.planner.getNextTask()) {
      await this.executeNext();
    }
    this.running = false;
    log('green', '\n✅ 全部任务执行完毕');
  }

  // ── Interactive mode ────────────────────────────────────
  async interact() {
    log('cyan', '\n╔══════════════════════════════════════════╗');
    log('cyan', '║     Tri-Link Autonomous Agent            ║');
    log('cyan', '║     Type "help" for commands             ║');
    log('cyan', '╚══════════════════════════════════════════╝\n');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const prompt = () => {
      rl.question(`${C.cyan}tri-link> ${C.reset}`, async (input) => {
        const cmd = input.trim().toLowerCase();

        if (!cmd) { prompt(); return; }
        if (cmd === 'help') {
          log('white', '\n可用命令:');
          log('  status           - 查看项目状态');
          log('  require <text>   - 提出开发需求');
          log('  plan             - 列出当前计划');
          log('  tasks            - 列出待处理任务');
          log('  run              - 自动执行所有任务');
          log('  memory           - 查看记忆摘要');
          log('  clear            - 清空待处理任务');
          log('  quit / exit      - 退出\n');
          prompt();
          return;
        }
        if (cmd === 'status') { this.status(); prompt(); return; }
        if (cmd === 'plan') {
          const plans = this.memory.data.plans;
          if (plans.length === 0) { log('dim', '  暂无计划'); }
          else {
            plans.forEach(p => log('  ', `• [${p.status}] ${p.title} (${p.tasks.length} tasks)`));
          }
          prompt(); return;
        }
        if (cmd === 'tasks') {
          const tasks = this.memory.data.tasks;
          if (tasks.length === 0) { log('green', '  无待处理任务'); }
          else {
            tasks.forEach(t => log('  ', `• [${t.priority}] ${t.title}`));
          }
          prompt(); return;
        }
        if (cmd === 'memory') {
          log('white', JSON.stringify(this.memory.getSummary(), null, 2));
          prompt(); return;
        }
        if (cmd === 'clear') {
          this.memory.data.tasks = [];
          this.memory.save();
          log('green', '  已清空待处理任务');
          prompt(); return;
        }
        if (cmd === 'run') {
          await this.runAll();
          prompt(); return;
        }
        if (cmd === 'quit' || cmd === 'exit') {
          rl.close();
          process.exit(0);
        }

        // Default: treat as requirement
        this.require(cmd);
        prompt();
      });
    };

    prompt();
  }

  // ── Non-interactive: single requirement ────────────────
  async run(requirement) {
    this.require(requirement);
    await this.runAll();
  }
}

module.exports = { Agent };

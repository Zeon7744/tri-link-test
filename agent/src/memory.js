'use strict';
/**
 * Memory Store - Persistent JSON-based knowledge for the agent
 * Stores: project context, plans, completed tasks, decisions, metrics
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.tri-link', 'memory.json');

class Memory {
  constructor(filePath = DEFAULT_PATH) {
    this.filePath = filePath;
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch {}
    return this._default();
  }

  _default() {
    return {
      version: '1.0.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      project: {
        name: 'tri-link-test',
        github: 'https://github.com/Zeon7744/tri-link-test',
        gitee: 'https://gitee.com/Zeon7744/tri-link-test',
        afdian: 'https://afdian.com/a/Zeon7744',
        description: 'GitHub + Gitee + AFDian three-way linkage framework',
      },
      plans: [],
      activePlan: null,
      tasks: [],
      completedTasks: [],
      decisions: [],
      metrics: {
        totalCommits: 0,
        totalFiles: 0,
        stars: 0,
        forks: 0,
        afdianSponsors: 0,
        monthlyIncome: 0,
        blogPosts: 0,
        paidIncome: 0,
      },
      agentState: {
        mode: 'idle',
        currentTask: null,
        conversationHistory: [],
        lastAction: null,
        lastActionTime: null,
      },
      config: {
        autoPush: true,
        autoCommit: true,
        autoTest: true,
        autoDeploy: false,
        notificationChannel: 'terminal',
      },
    };
  }


  /** Load AFDian daemon state and update metrics */
  syncAfdianData() {
    try {
      const home = process.env.HOME || process.env.USERPROFILE;
      const statePath = path.join(home, '.tri-link', 'daemon-state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.lastStatus === 'ok' && state.totalFetches > 0) {
          this.updateMetrics({ lastAfdianFetch: state.lastFetch });
          if (state.sponsors && Array.isArray(state.sponsors)) {
            this.data.metrics.afdianSponsors = state.sponsors.length;
          }
          this.save();
        }
      }
    } catch (err) { /* silent */ }
  }

  save() {
    this.data.lastUpdated = new Date().toISOString();
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  get(key) { return this.data[key]; }
  set(key, value) { this.data[key] = value; this.save(); }

  clearTasks() {
    this.data.tasks = [];
    this.save();
  }

  addTask(task) {
    task.id = `task-${Date.now()}`;
    task.status = 'pending';
    task.created = new Date().toISOString();
    this.data.tasks.push(task);
    this.save();
    return task;
  }

  completeTask(taskId, result) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.completed = new Date().toISOString();
      task.result = result;
      this.data.completedTasks.push({ ...task });
      this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
      this.save();
    }
    return task;
  }

  addDecision(decision) {
    decision.id = `dec-${Date.now()}`;
    decision.time = new Date().toISOString();
    this.data.decisions.push(decision);
    this.save();
    return decision;
  }

  addPlan(plan) {
    plan.id = `plan-${Date.now()}`;
    plan.created = new Date().toISOString();
    plan.status = 'active';
    this.data.plans.push(plan);
    this.data.activePlan = plan.id;
    this.save();
    return plan;
  }

  updateMetrics(updates) {
    Object.assign(this.data.metrics, updates);
    this.save();
  }

  getSummary() {
    const { tasks, completedTasks, plans, metrics } = this.data;
    return {
      activeTasks: tasks.length,
      completedTasks: completedTasks.length,
      totalPlans: plans.length,
      activePlan: plans.find(p => p.id === this.data.activePlan)?.title || 'none',
      afdianLastFetch: this.data.metrics.lastAfdianFetch || null,
      metrics,
      lastPlan: plans[plans.length - 1]?.title || 'none',
    };
  }
}

module.exports = { Memory };

'use strict';
/**
 * Optimizer - Analyzes task durations to improve future estimates
 */
const fs = require('fs');
const path = require('path');

class Optimizer {
  constructor(brain) {
    this.brain = brain;
  }

  /**
   * Analyze past tasks and suggest better time estimates
   */
  analyze() {
    const history = this.brain.data.experience.taskHistory;
    if (history.length < 3) return { suggestions: [], note: 'Not enough data yet' };

    const suggestions = [];
    const categories = this._groupByCategory(history);

    for (const [cat, tasks] of Object.entries(categories)) {
      if (tasks.length < 2) continue;
      const durations = tasks.filter(t => t.duration).map(t => t.duration);
      if (durations.length < 2) continue;

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);

      // Check if there's significant variance
      if (max > avg * 2) {
        suggestions.push({
          category: cat,
          avgSeconds: Math.round(avg),
          variance: 'high',
          hint: `Task ${cat} varies widely (${Math.round(min)}s-${Math.round(max)}s). Consider breaking into smaller steps.`,
        });
      }
    }

    return { suggestions, note: `Analyzed ${history.length} tasks across ${Object.keys(categories).length} categories` };
  }

  /**
   * Suggest estimate for a requirement based on past data
   */
  suggestEstimate(requirement) {
    const req = requirement.toLowerCase();
    const history = this.brain.data.experience.taskHistory;

    // Find matching categories
    const matches = [];
    for (const task of history) {
      if (req.includes(task.category) || task.title.toLowerCase().includes(req.substring(0, 4))) {
        matches.push(task);
      }
    }

    if (matches.length === 0) return null;

    const durations = matches.filter(t => t.duration).map(t => t.duration);
    if (durations.length === 0) return null;

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    // Estimate: average * 1.5 for buffer
    const estimatedSeconds = Math.round(avg * 1.5);
    const hours = Math.ceil(estimatedSeconds / 3600);
    const minutes = Math.ceil((estimatedSeconds % 3600) / 60);

    return {
      estimate: hours > 0 ? `${hours}h${minutes > 0 ? minutes + 'min' : ''}` : `${minutes}min`,
      avgSeconds: Math.round(avg),
      sampleSize: durations.length,
    };
  }

  _groupByCategory(history) {
    const groups = {};
    for (const task of history) {
      const cat = task.category || 'unknown';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(task);
    }
    return groups;
  }
}

module.exports = { Optimizer };

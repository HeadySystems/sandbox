/**
 * ClaudeTaskRouter — Routes incoming tasks to the optimal Claude agent capability
 *
 * Uses semantic relevance gates (phi-derived) instead of arbitrary priority levels.
 * Every task gets equal treatment — routing is by domain match and capability fit.
 *
 * @module ClaudeTaskRouter
 * @version 4.0.0
 */

import { routeTask, CLAUDE_CAPABILITIES, RELEVANCE_GATES, PHI, PSI, FIB } from './heady-claude-agent.js';

/**
 * Task execution context — carries metadata through the pipeline
 */
class TaskContext {
  constructor(description, metadata = {}) {
    this.id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.description = description;
    this.metadata = metadata;
    this.createdAt = new Date().toISOString();
    this.route = null;
    this.status = 'pending';
    this.results = [];
    this.retryCount = 0;
    this.maxRetries = FIB[4]; // 3 retries (Fibonacci)
  }

  setRoute(route) {
    this.route = route;
    this.status = 'routed';
    return this;
  }

  markInProgress() {
    this.status = 'in_progress';
    this.startedAt = new Date().toISOString();
    return this;
  }

  markCompleted(result) {
    this.status = 'completed';
    this.completedAt = new Date().toISOString();
    this.results.push(result);
    return this;
  }

  markFailed(error) {
    this.status = 'failed';
    this.error = error;
    this.retryCount++;
    return this;
  }

  canRetry() {
    return this.retryCount < this.maxRetries;
  }

  toJSON() {
    return {
      id: this.id,
      description: this.description,
      route: this.route,
      status: this.status,
      retryCount: this.retryCount,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      metadata: this.metadata,
    };
  }
}

/**
 * Multi-task parallel executor
 * Fires all independent tasks concurrently — no serialization of independent work
 */
class ParallelExecutor {
  constructor() {
    this.activeTasks = new Map();
    this.maxConcurrent = FIB[6]; // 8 concurrent tasks (Fibonacci)
  }

  /**
   * Execute multiple tasks concurrently
   * @param {TaskContext[]} tasks — Array of task contexts
   * @param {Function} executeFn — Function to execute each task
   * @returns {Promise<TaskContext[]>} — Completed tasks
   */
  async executeAll(tasks, executeFn) {
    const chunks = [];
    for (let i = 0; i < tasks.length; i += this.maxConcurrent) {
      chunks.push(tasks.slice(i, i + this.maxConcurrent));
    }

    const results = [];
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(task => this.executeOne(task, executeFn))
      );
      results.push(...chunkResults.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        chunk[i].markFailed(r.reason?.message || 'Unknown error');
        return chunk[i];
      }));
    }

    return results;
  }

  async executeOne(task, executeFn) {
    task.markInProgress();
    this.activeTasks.set(task.id, task);

    try {
      const result = await executeFn(task);
      task.markCompleted(result);
      return task;
    } catch (error) {
      task.markFailed(error.message);
      throw error;
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  getActiveCount() {
    return this.activeTasks.size;
  }
}

/**
 * Route and decompose a complex task into sub-tasks
 * @param {string} taskDescription — High-level task description
 * @returns {TaskContext[]} — Array of routed sub-tasks
 */
function decomposeTask(taskDescription) {
  const route = routeTask(taskDescription);

  // Single capability match — return as one task
  if (route.confidence >= RELEVANCE_GATES.boost) {
    const task = new TaskContext(taskDescription);
    task.setRoute(route);
    return [task];
  }

  // Low confidence — might need multiple capabilities
  // Decompose into diagnostic + primary route
  const diagnosticTask = new TaskContext(`Diagnose context for: ${taskDescription}`);
  diagnosticTask.setRoute(routeTask('diagnose and check status'));

  const primaryTask = new TaskContext(taskDescription);
  primaryTask.setRoute(route);

  return [diagnosticTask, primaryTask];
}

export { TaskContext, ParallelExecutor, decomposeTask };

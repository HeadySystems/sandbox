/**
 * @fileoverview SwarmMessageBus - Inter-swarm communication backbone
 */
import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export class SwarmMessageBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    this._subscribers = new Map();
    this._messageHistory = [];
    this._maxHistory = 1000;
  }

  /**
   * Subscribe to topic
   * @param {string} topic - Topic pattern (supports wildcards)
   * @param {Function} handler - Message handler
   */
  subscribe(topic, handler) {
    if (!this._subscribers.has(topic)) {
      this._subscribers.set(topic, []);
    }
    this._subscribers.get(topic).push(handler);
  }

  /**
   * Publish message
   * @param {string} topic - Target topic
   * @param {object} message - Message payload
   * @param {object} metadata - Optional metadata
   */
  publish(topic, message, metadata = {}) {
    const envelope = {
      id: createHash('sha256').update(JSON.stringify(message) + Date.now()).digest('hex').slice(0, 16),
      topic,
      message,
      metadata,
      timestamp: Date.now(),
    };

    // Store in history
    this._messageHistory.push(envelope);
    if (this._messageHistory.length > this._maxHistory) {
      this._messageHistory.shift();
    }

    // Deliver to subscribers
    for (const [pattern, handlers] of this._subscribers) {
      if (this._matchTopic(topic, pattern)) {
        handlers.forEach(h => h(envelope));
      }
    }

    this.emit('message:published', envelope);
  }

  /**
   * Topic pattern matching
   */
  _matchTopic(topic, pattern) {
    if (pattern === '*') return true;
    if (pattern === topic) return true;
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return regex.test(topic);
  }

  /**
   * Get message history
   */
  getHistory(limit = 100) {
    return this._messageHistory.slice(-limit);
  }
}

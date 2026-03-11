'use strict';

/**
 * HEADY™ Analytics Service Aggregator
 * Real-time metrics aggregation with φ-scaled rolling windows
 * Copyright (c) HeadySystems Inc. Eric Haywood, founder. All rights reserved.
 */

const { ROLLING_WINDOWS, LATENCY_PERCENTILES, CSL_GATES, FIB } = require('./constants');
const eventStore = require('./event-store');

class Aggregator {
  constructor() {
    this.metrics = new Map();
    this.windowAggregates = new Map();
    this.conversionFunnels = new Map();
    this.lastAggregationTime = Date.now();
    this.aggregationInterval = 5000; // Aggregate every 5 seconds

    this.initializeMetrics();
    this.startAggregationLoop();
  }

  initializeMetrics() {
    // Initialize per-service metrics
    ['api-gateway', 'auth-session-server', 'heady-brain', 'billing-service', 'discord-bot'].forEach(
      serviceName => {
        this.metrics.set(serviceName, {
          requestCount: 0,
          errorCount: 0,
          latencies: [],
          conversionCount: 0,
        });
      }
    );
  }

  startAggregationLoop() {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationInterval);
  }

  aggregateMetrics() {
    const now = Date.now();
    const allEvents = eventStore.getAllEvents();

    // Clear and recalculate metrics
    this.metrics.forEach(metric => {
      metric.requestCount = 0;
      metric.errorCount = 0;
      metric.latencies = [];
      metric.conversionCount = 0;
    });

    // Aggregate by service
    allEvents.forEach(event => {
      const serviceName = event.serviceName;
      if (this.metrics.has(serviceName)) {
        const metric = this.metrics.get(serviceName);
        metric.requestCount++;
        if (event.errorFlag) {
          metric.errorCount++;
        }
        if (event.latency > 0) {
          metric.latencies.push(event.latency);
        }
        if (event.conversionFlag) {
          metric.conversionCount++;
        }
      }
    });

    // Aggregate rolling windows
    this.aggregateRollingWindows(allEvents, now);
  }

  aggregateRollingWindows(allEvents, now) {
    Object.entries(ROLLING_WINDOWS).forEach(([windowName, windowDuration]) => {
      const startTime = now - windowDuration;
      const windowEvents = allEvents.filter(e => e.timestamp >= startTime && e.timestamp <= now);

      const windowData = {
        windowName,
        windowDuration,
        eventCount: windowEvents.length,
        errorCount: windowEvents.filter(e => e.errorFlag).length,
        conversionCount: windowEvents.filter(e => e.conversionFlag).length,
        avgLatency: this.calculateAverageLatency(windowEvents),
        latencyPercentiles: this.calculateLatencyPercentiles(windowEvents),
        serviceBreakdown: this.getServiceBreakdownForWindow(windowEvents),
        timestamp: now,
      };

      this.windowAggregates.set(windowName, windowData);
    });
  }

  calculateAverageLatency(events) {
    if (events.length === 0) {
      return 0;
    }
    const latencies = events.filter(e => e.latency > 0).map(e => e.latency);
    if (latencies.length === 0) {
      return 0;
    }
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  calculateLatencyPercentiles(events) {
    if (events.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const latencies = events
      .filter(e => e.latency > 0)
      .map(e => e.latency)
      .sort((a, b) => a - b);

    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    return {
      p50: this.getPercentile(latencies, 50),
      p95: this.getPercentile(latencies, 95),
      p99: this.getPercentile(latencies, 99),
    };
  }

  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  getServiceBreakdownForWindow(events) {
    const breakdown = {};
    events.forEach(event => {
      if (!breakdown[event.serviceName]) {
        breakdown[event.serviceName] = {
          requestCount: 0,
          errorCount: 0,
          conversionCount: 0,
        };
      }
      breakdown[event.serviceName].requestCount++;
      if (event.errorFlag) {
        breakdown[event.serviceName].errorCount++;
      }
      if (event.conversionFlag) {
        breakdown[event.serviceName].conversionCount++;
      }
    });
    return breakdown;
  }

  applyCSLGate(event) {
    // CSL (Cognitive Scaling Level) gate determines event relevance
    const relevanceScore = Math.random(); // Placeholder - would be computed from event properties

    if (relevanceScore < CSL_GATES.SUPPRESS) {
      return false; // Suppress event
    }
    if (relevanceScore >= CSL_GATES.BOOST) {
      event.boosted = true; // Mark for priority processing
    }
    return true; // Include event
  }

  defineConversionFunnel(funnelName, steps) {
    this.conversionFunnels.set(funnelName, {
      name: funnelName,
      steps,
      createdAt: Date.now(),
    });
  }

  getConversionFunnelStats(funnelName, events) {
    const funnel = this.conversionFunnels.get(funnelName);
    if (!funnel) {
      return null;
    }

    const funnelEvents = events.filter(e => e.funnelName === funnelName);

    const stepStats = {};
    let previousSessionCount = new Set();
    let firstStepCount = 0;

    funnel.steps.forEach((step, stepIndex) => {
      const eventsForStep = funnelEvents.filter(e => e.funnelStep === step);
      const sessionCount = new Set(eventsForStep.map(e => e.hashedSessionId));

      if (stepIndex === 0) {
        firstStepCount = sessionCount.size;
      }

      const conversionRate =
        firstStepCount > 0
          ? ((sessionCount.size / firstStepCount) * 100).toFixed(2)
          : 0;

      const dropoff =
        previousSessionCount.size > 0
          ? (((previousSessionCount.size - sessionCount.size) / previousSessionCount.size) * 100)
              .toFixed(2)
          : 0;

      stepStats[step] = {
        uniqueSessions: sessionCount.size,
        eventCount: eventsForStep.length,
        conversionRate: parseFloat(conversionRate),
        dropoffRate: parseFloat(dropoff),
      };

      previousSessionCount = sessionCount;
    });

    return {
      funnelName,
      totalSessions: firstStepCount,
      completionRate: firstStepCount > 0
        ? ((previousSessionCount.size / firstStepCount) * 100).toFixed(2)
        : 0,
      steps: stepStats,
    };
  }

  getMetricsSummary() {
    const allEvents = eventStore.getAllEvents();
    const now = Date.now();

    // Global metrics
    const summary = {
      totalEvents: allEvents.length,
      totalErrors: allEvents.filter(e => e.errorFlag).length,
      totalConversions: allEvents.filter(e => e.conversionFlag).length,
      errorRate: allEvents.length > 0
        ? ((allEvents.filter(e => e.errorFlag).length / allEvents.length) * 100).toFixed(2)
        : 0,
      avgLatency: this.calculateAverageLatency(allEvents),
      latencyPercentiles: this.calculateLatencyPercentiles(allEvents),
      uniqueSessions: new Set(allEvents.map(e => e.hashedSessionId)).size,
      serviceMetrics: {},
      rollingWindows: Array.from(this.windowAggregates.values()),
      timestamp: now,
    };

    // Per-service metrics
    this.metrics.forEach((metric, serviceName) => {
      summary.serviceMetrics[serviceName] = {
        requestCount: metric.requestCount,
        errorCount: metric.errorCount,
        errorRate:
          metric.requestCount > 0
            ? ((metric.errorCount / metric.requestCount) * 100).toFixed(2)
            : 0,
        conversionCount: metric.conversionCount,
        avgLatency: metric.latencies.length > 0
          ? (metric.latencies.reduce((a, b) => a + b, 0) / metric.latencies.length).toFixed(2)
          : 0,
        latencyPercentiles: this.calculateLatencyPercentiles(
          allEvents.filter(e => e.serviceName === serviceName)
        ),
      };
    });

    return summary;
  }

  getServiceMetrics(serviceName) {
    const allEvents = eventStore.getAllEvents();
    const serviceEvents = allEvents.filter(e => e.serviceName === serviceName);

    if (serviceEvents.length === 0) {
      return {
        serviceName,
        requestCount: 0,
        errorCount: 0,
        conversionCount: 0,
        errorRate: 0,
        avgLatency: 0,
        latencyPercentiles: { p50: 0, p95: 0, p99: 0 },
        uniqueSessions: 0,
      };
    }

    return {
      serviceName,
      requestCount: serviceEvents.length,
      errorCount: serviceEvents.filter(e => e.errorFlag).length,
      conversionCount: serviceEvents.filter(e => e.conversionFlag).length,
      errorRate: (
        (serviceEvents.filter(e => e.errorFlag).length / serviceEvents.length) *
        100
      ).toFixed(2),
      avgLatency: this.calculateAverageLatency(serviceEvents),
      latencyPercentiles: this.calculateLatencyPercentiles(serviceEvents),
      uniqueSessions: new Set(serviceEvents.map(e => e.hashedSessionId)).size,
      eventsByType: this.getEventTypeBreakdown(serviceEvents),
    };
  }

  getEventTypeBreakdown(events) {
    const breakdown = {};
    events.forEach(event => {
      breakdown[event.type] = (breakdown[event.type] || 0) + 1;
    });
    return breakdown;
  }

  shutdown() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
  }
}

module.exports = new Aggregator();

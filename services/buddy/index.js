const express = require('express');
const router = express.Router();
const { createLogger } = require('../../packages/structured-logger');
const log = createLogger('buddy-service');

const buddyStartTime = Date.now();

let continuousPipeline = {
  running: false,
  cycleCount: 0,
  lastCycleTs: null,
  exitReason: null,
  errors: [],
  gateResults: { quality: null, resource: null, stability: null, user: null },
  intervalId: null,
};

// Dependency injection
let _deps = {};
function init(deps) {
  _deps = deps; // { loadRegistry, resourceManager, resourceDiagnostics, storyDriver, pipeline, patternEngine }
}

// ─── GET /health ────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'heady-buddy',
    version: '2.0.0',
    uptime: (Date.now() - buddyStartTime) / 1000,
    continuousMode: continuousPipeline.running,
    ts: new Date().toISOString(),
  });
});

// ─── POST /chat ──────────────────────────────────────────────────────
router.post('/chat', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const { loadRegistry, resourceDiagnostics, resourceManager, storyDriver, taskScheduler } = _deps;
  
  const reg = loadRegistry();
  const nodeCount = Object.keys(reg.nodes || {}).length;
  const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === 'active').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning!' : hour < 18 ? 'Good afternoon!' : 'Good evening!';

  let reply = '';
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('diagnose') || lowerMsg.includes('what\'s wrong') || lowerMsg.includes('issues')) {
    if (resourceDiagnostics) {
      const diag = resourceDiagnostics.diagnose();
      const findings = diag.findings || [];
      reply = `Found ${findings.length} diagnostic findings. ${findings.length > 0 ? `Top: ${findings[0].title} (${findings[0].severity}).` : 'No critical issues.'} Run "apply quick wins" for suggestions.`;
    } else {
      reply = 'Diagnostics module not available.';
    }
  } else if (lowerMsg.includes('apply quick win') || lowerMsg.includes('fix it') || lowerMsg.includes('apply fix')) {
    if (resourceDiagnostics) {
      const diag = resourceDiagnostics.lastDiagnosis || resourceDiagnostics.diagnose();
      const applied = [];
      for (const win of diag.quickWins || []) {
        if (win.configChange && taskScheduler) {
          const { endpoint, body } = win.configChange;
          if (endpoint.includes('concurrency') && body.taskClass && body.limit != null) {
            taskScheduler.adjustConcurrency(body.taskClass, body.limit);
            applied.push(win.title);
          } else if (endpoint.includes('safe-mode') && body.enabled) {
            taskScheduler.enterSafeMode();
            applied.push(win.title);
          }
        }
      }
      reply = applied.length > 0
        ? `Applied ${applied.length} quick wins:\n${applied.map(a => `✓ ${a}`).join("\n")}\n\nMonitoring for improvement.`
        : 'No auto-applicable quick wins right now. Check the Resources tab for manual options.';
    } else {
      reply = 'Diagnostics module not available.';
    }
  } else if (lowerMsg.includes('scheduler') || lowerMsg.includes('queue') || lowerMsg.includes('task')) {
    if (taskScheduler) {
      const st = taskScheduler.getStatus();
      const totalQ = st.queues.interactive + st.queues.batch + st.queues.training;
      const totalR = st.running.interactive + st.running.batch + st.running.training;
      reply = `Scheduler: ${totalQ} queued, ${totalR} running. Completed: ${st.stats.totalCompleted}. Avg wait: ${st.stats.avgWaitMs}ms, avg exec: ${st.stats.avgExecMs}ms. Safe mode: ${st.safeModeActive ? 'ON' : 'off'}. ${st.paused ? '⏸ PAUSED' : '▶ Active'}.`;
    } else {
      reply = 'Task Scheduler not loaded. Submit tasks via /api/scheduler/submit.';
    }
  } else if (lowerMsg.includes('slow') || lowerMsg.includes('taking so long') || (lowerMsg.includes('explain') && lowerMsg.includes('slowdown'))) {
    if (resourceDiagnostics) {
      const diag = resourceDiagnostics.diagnose();
      const snap = resourceManager ? resourceManager.getSnapshot() : {};
      const cpuPct = snap.cpu?.currentPercent || 0;
      const ramPct = snap.ram?.currentPercent || 0;
      const topIssue = diag.findings?.[0];
      reply = `CPU: ${cpuPct}%, RAM: ${ramPct}%. ${diag.totalFindings} diagnostic findings. ${topIssue ? `Top issue: ${topIssue.title} (${topIssue.severity}).` : 'No critical issues.'} Say "diagnose" for full report or "apply quick wins" for fast fixes.`;
    } else if (resourceManager) {
      const snap = resourceManager.getSnapshot();
      const events = resourceManager.getRecentEvents(5);
      const cpuPct = snap.cpu?.currentPercent || 0;
      const ramPct = snap.ram?.currentPercent || 0;
      const contributors = events.length > 0 && events[events.length - 1].contributors
        ? events[events.length - 1].contributors.slice(0, 3).map(c => `${c.description} (${c.ramMB || 0} MB)`).join(', ')
        : 'no major contributors detected';
      const severity = cpuPct >= 90 || ramPct >= 85 ? 'CRITICAL' : cpuPct >= 75 || ramPct >= 70 ? 'CONSTRAINED' : 'HEALTHY';
      reply = `Resource status: ${severity}. CPU: ${cpuPct}%, RAM: ${ramPct}%. Top contributors: ${contributors}. ${snap.safeMode ? 'Safe mode is ACTIVE.' : ''} Check the Resources tab for details.`;
    } else {
      reply = `System memory at ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap. For detailed analysis, the Resource Manager needs to be running.`;
    }
  } else if (lowerMsg.includes('resource') || lowerMsg.includes('gpu') || lowerMsg.includes('tier')) {
    if (resourceManager) {
      const snap = resourceManager.getSnapshot();
      const diskInfo = snap.disk && snap.disk.capacity > 0 ? `, Disk ${snap.disk.currentPercent}%` : '';
      reply = `Resource overview: CPU ${snap.cpu?.currentPercent || 0}%, RAM ${snap.ram?.currentPercent || 0}%${diskInfo}${snap.gpu ? `, GPU ${snap.gpu.compute?.currentPercent || 0}%` : ''}. ${activeNodes}/${nodeCount} nodes active. ${snap.safeMode ? '⚠ Safe mode active.' : ''} Say "diagnose" for deep analysis.`;
    } else {
      reply = `Resource overview: ${activeNodes}/${nodeCount} nodes active. Memory: ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap. Check the Orchestrator tab for details.`;
    }
  } else if (lowerMsg.includes('story') || lowerMsg.includes('what changed') || lowerMsg.includes('narrative')) {
    if (storyDriver) {
      const sysSummary = storyDriver.getSystemSummary();
      reply = `Story Driver: ${sysSummary.totalStories} stories (${sysSummary.ongoing} ongoing). ${sysSummary.recentNarrative || 'No recent events.'} Check the Story tab in Expanded View for full timelines.`;
    } else {
      reply = 'Story Driver is not loaded. It tracks project narratives, feature lifecycles, and incident timelines.';
    }
  } else if (lowerMsg.includes('status') || lowerMsg.includes('health')) {
    reply = `System healthy. ${activeNodes}/${nodeCount} nodes active. Uptime: ${Math.round(process.uptime())}s. Continuous mode: ${continuousPipeline.running ? 'active' : 'off'}.`;
  } else if (lowerMsg.includes('help') || lowerMsg.includes('what can')) {
    reply = `I can help with: planning your day, running HCFullPipeline, monitoring resources/nodes, orchestrating parallel tasks, automating workflows, and checking system health.`;
  } else if (lowerMsg.includes('stop') || lowerMsg.includes('pause')) {
    if (continuousPipeline.running) {
      clearInterval(continuousPipeline.intervalId);
      continuousPipeline.running = false;
      continuousPipeline.exitReason = 'user_requested_stop';
      reply = `Continuous pipeline stopped after ${continuousPipeline.cycleCount} cycles. Resume anytime.`;
    } else {
      reply = 'No continuous pipeline running. I\'m here whenever you need me!';
    }
  } else {
    reply = `${greeting} I'm HeadyBuddy, your perfect day AI companion and orchestration copilot. ${activeNodes} nodes standing by. How can I help?`;
  }

  res.json({
    reply,
    context: {
      nodes: { total: nodeCount, active: activeNodes },
      continuousMode: continuousPipeline.running,
      cycleCount: continuousPipeline.cycleCount,
    },
    ts: new Date().toISOString(),
  });
});

// ─── GET /suggestions ────────────────────────────────────────────────
router.get('/suggestions', (req, res) => {
  const { loadRegistry } = _deps;
  const hour = new Date().getHours();
  const reg = loadRegistry();
  const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === 'active').length;
  const chips = [];

  if (hour < 10) chips.push({ label: 'Plan my morning', icon: 'calendar', prompt: 'Help me plan my morning.' });
  else if (hour < 14) chips.push({ label: 'Plan my afternoon', icon: 'calendar', prompt: 'Help me plan my afternoon.' });
  else if (hour < 18) chips.push({ label: 'Wrap up my day', icon: 'calendar', prompt: 'Help me wrap up today.' });
  else chips.push({ label: 'Plan tomorrow', icon: 'calendar', prompt: 'Help me plan tomorrow.' });

  chips.push({ label: 'Summarize this', icon: 'file-text', prompt: 'Summarize the content I\'m looking at.' });
  chips.push({ label: continuousPipeline.running ? 'Pipeline status' : 'Run pipeline', icon: 'play', prompt: continuousPipeline.running ? 'Show pipeline status.' : 'Start HCFullPipeline.' });
  if (activeNodes > 0) chips.push({ label: 'Check resources', icon: 'activity', prompt: 'Show resource usage and node health.' });
  chips.push({ label: 'Surprise me', icon: 'sparkles', prompt: 'Suggest something useful right now.' });

  res.json({ suggestions: chips.slice(0, 5), ts: new Date().toISOString() });
});

// ─── GET /orchestrator ───────────────────────────────────────────────
router.get('/orchestrator', (req, res) => {
  const { loadRegistry } = _deps;
  const reg = loadRegistry();
  const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({
    id, name: n.name || id, role: n.role || 'unknown',
    status: n.status || 'unknown', tier: n.tier || 'M',
    lastInvoked: n.last_invoked || null,
  }));
  const mem = process.memoryUsage();

  res.json({
    ok: true,
    system: {
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
      },
    },
    nodes: {
      total: nodes.length,
      active: nodes.filter(n => n.status === 'active').length,
      list: nodes,
    },
    resourceTiers: {
      L: nodes.filter(n => n.tier === 'L').length,
      M: nodes.filter(n => n.tier === 'M').length,
      S: nodes.filter(n => n.tier === 'S').length,
    },
    pipeline: {
      available: true,
      state: null,
      continuous: {
        running: continuousPipeline.running,
        cycleCount: continuousPipeline.cycleCount,
        lastCycleTs: continuousPipeline.lastCycleTs,
        exitReason: continuousPipeline.exitReason,
        gates: continuousPipeline.gateResults,
        recentErrors: continuousPipeline.errors.slice(-5),
      },
    },
    ts: new Date().toISOString(),
  });
});

// ─── POST /pipeline/continuous ──────────────────────────────────────
router.post('/pipeline/continuous', (req, res) => {
  const { storyDriver } = _deps;
  const { action = 'start' } = req.body;

  if (action === 'stop') {
    if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
    continuousPipeline.running = false;
    continuousPipeline.exitReason = 'user_requested_stop';
    return res.json({ ok: true, action: 'stopped', cycleCount: continuousPipeline.cycleCount, ts: new Date().toISOString() });
  }

  if (continuousPipeline.running) return res.json({ ok: true, action: 'already_running', cycleCount: continuousPipeline.cycleCount });

  continuousPipeline.running = true;
  continuousPipeline.exitReason = null;
  continuousPipeline.errors = [];
  continuousPipeline.cycleCount = 0;

  const runCycle = () => {
    if (!continuousPipeline.running) return;
    continuousPipeline.cycleCount++;
    continuousPipeline.lastCycleTs = new Date().toISOString();
    continuousPipeline.gateResults = {
      quality: true,
      resource: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) < 0.9,
      stability: true,
      user: continuousPipeline.running,
    };
    const allPass = Object.values(continuousPipeline.gateResults).every(Boolean);

    // Emit story events for pipeline cycles
    if (storyDriver) {
      if (allPass) {
        storyDriver.ingestSystemEvent({
          type: 'PIPELINE_CYCLE_COMPLETE',
          refs: { cycleNumber: continuousPipeline.cycleCount, gatesSummary: 'all passed' },
          source: 'hcfullpipeline',
        });
      } else {
        storyDriver.ingestSystemEvent({
          type: 'PIPELINE_GATE_FAIL',
          refs: {
            cycleNumber: continuousPipeline.cycleCount,
            gate: Object.entries(continuousPipeline.gateResults).find(([, v]) => !v)?.[0] || 'unknown',
            reason: 'Gate check returned false',
          },
          source: 'hcfullpipeline',
        });
      }
    }

    if (!allPass) {
      continuousPipeline.running = false;
      continuousPipeline.exitReason = 'gate_failed';
      if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
    }
  };

  runCycle();
  if (continuousPipeline.running) {
    continuousPipeline.intervalId = setInterval(runCycle, req.body.intervalMs || 30000);
  }

  res.json({
    ok: true, action: 'started', running: continuousPipeline.running,
    cycleCount: continuousPipeline.cycleCount, gates: continuousPipeline.gateResults,
    ts: new Date().toISOString(),
  });
});

// ─── GET /state ──────────────────────────────────────────────────────
router.get('/state', (req, res) => {
  res.json({
    ok: true,
    buddy: {
      running: true,
      startTime: buddyStartTime,
      uptime: (Date.now() - buddyStartTime) / 1000,
    },
    pipeline: continuousPipeline,
    ts: new Date().toISOString(),
  });
});

// ─── POST /state ─────────────────────────────────────────────────────
router.post('/state', (req, res) => {
  const { pipeline } = req.body;
  
  if (pipeline) {
    Object.assign(continuousPipeline, pipeline);
  }

  res.json({
    ok: true,
    pipeline: continuousPipeline,
    ts: new Date().toISOString(),
  });
});

// ─── GET /sync-events ────────────────────────────────────────────────
router.get('/sync-events', (req, res) => {
  const { storyDriver } = _deps;
  
  if (!storyDriver) {
    return res.json({ ok: false, error: 'Story Driver not available', events: [] });
  }

  const summary = storyDriver.getSystemSummary();
  const events = storyDriver.getRecentEvents ? storyDriver.getRecentEvents(20) : [];

  res.json({
    ok: true,
    summary,
    events,
    ts: new Date().toISOString(),
  });
});

module.exports = { router, init, continuousPipeline };

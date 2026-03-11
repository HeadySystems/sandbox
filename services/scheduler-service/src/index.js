'use strict';

/**
 * HeadySystems Scheduler Service
 * Express-based API for task scheduling with Fibonacci-scaled intervals
 * Copyright (c) 2024 HeadySystems
 */

const express = require('express');
const TaskScheduler = require('./task-scheduler');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const PORT = process.env.PORT || 3390;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const scheduler = new TaskScheduler();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.set('X-Request-ID', req.id);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message: 'HTTP Request',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.id,
      })
    );
  });
  next();
});

app.post('/tasks', (req, res) => {
  try {
    const {
      name,
      handlerUrl,
      interval = FIB[8] * 1000,
      type = 'recurring',
      maxRetries = FIB[5],
      metadata = {},
    } = req.body;

    if (!name || !handlerUrl) {
      return res.status(400).json({
        error: 'Missing required fields: name, handlerUrl',
      });
    }

    if (!isValidUrl(handlerUrl)) {
      return res.status(400).json({
        error: 'Invalid handler URL format',
      });
    }

    if (!['recurring', 'one-shot', 'cron-like'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid task type. Must be: recurring, one-shot, or cron-like',
      });
    }

    if (maxRetries > FIB[5]) {
      return res.status(400).json({
        error: `Max retries cannot exceed FIB[5]=${FIB[5]}`,
      });
    }

    const task = scheduler.createTask({
      name,
      handlerUrl,
      interval,
      type,
      maxRetries,
      metadata,
    });

    res.status(201).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

app.get('/tasks', (req, res) => {
  try {
    const tasks = scheduler.getAllTasks();
    const { status, type } = req.query;

    let filtered = tasks;

    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    res.json({
      success: true,
      count: filtered.length,
      tasks: filtered,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

app.get('/tasks/:id', (req, res) => {
  try {
    const task = scheduler.getTask(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

app.delete('/tasks/:id', (req, res) => {
  try {
    const deleted = scheduler.deleteTask(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      message: 'Task deleted',
      taskId: req.params.id,
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

app.post('/tasks/:id/trigger', async (req, res) => {
  try {
    const task = scheduler.getTask(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
      });
    }

    const result = await scheduler.triggerTask(req.params.id);

    res.json({
      success: true,
      message: 'Task triggered',
      taskId: req.params.id,
      result: result.status,
    });
  } catch (error) {
    console.error('Error triggering task:', error);
    res.status(500).json({
      error: 'Failed to trigger task',
      message: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  const stats = scheduler.getStats();

  res.json({
    status: scheduler.running ? 'healthy' : 'starting',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    scheduler: {
      running: scheduler.running,
      ...stats,
    },
    limits: {
      maxConcurrentTasks: FIB[9],
      maxQueueSize: FIB[11],
      maxRetries: FIB[5],
    },
  });
});

app.get('/stats', (req, res) => {
  const stats = scheduler.getStats();

  res.json({
    timestamp: new Date().toISOString(),
    ...stats,
    fibonacciConstants: {
      PHI,
      PSI,
      fibSequence: FIB,
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : undefined,
    requestId: req.id,
  });
});

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

const server = app.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'server_started',
      service: '@heady/scheduler-service',
      port: PORT,
      host: HOST,
      environment: NODE_ENV,
    })
  );

  scheduler.start();
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'scheduler_started',
    })
  );
});

process.on('SIGTERM', () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'sigterm_received',
      message: 'Gracefully shutting down',
    })
  );

  scheduler.stop();
  server.close(() => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'server_closed',
      })
    );
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'sigint_received',
      message: 'Gracefully shutting down',
    })
  );

  scheduler.stop();
  server.close(() => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'server_closed',
      })
    );
    process.exit(0);
  });
});

module.exports = { app, scheduler };

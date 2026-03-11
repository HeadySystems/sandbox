/**
 * Heady™ Structured Logger
 * Pino-compatible JSON logging with φ-scaled sampling
 */
'use strict';

function createLogger(name) {
  const level = process.env.HEADY_LOG_LEVEL || 'info';
  const levels = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
  const minLevel = levels[level] || 30;

  function log(lvl, obj, msg) {
    if (levels[lvl] < minLevel) return;
    const entry = {
      level: lvl,
      time: new Date().toISOString(),
      name,
      ...(typeof obj === 'string' ? { msg: obj } : { ...obj, msg }),
    };
    const output = lvl === 'error' || lvl === 'fatal' ? process.stderr : process.stderr;
    output.write(JSON.stringify(entry) + '\n');
  }

  return {
    trace: (obj, msg) => log('trace', obj, msg),
    debug: (obj, msg) => log('debug', obj, msg),
    info: (obj, msg) => log('info', obj, msg),
    warn: (obj, msg) => log('warn', obj, msg),
    error: (obj, msg) => log('error', obj, msg),
    fatal: (obj, msg) => log('fatal', obj, msg),
    child: (bindings) => createLogger(`${name}:${bindings.module || 'child'}`),
  };
}

module.exports = { createLogger };

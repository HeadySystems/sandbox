'use strict';
/**
 * HeadyConductor Logger — minimal CommonJS logger
 * Production logger; this file is a compatibility shim when the real
 * logger module is not present in this context.
 */

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] ?? levels.info;

function makeLogger(namespace) {
  const prefix = namespace ? `[${namespace}]` : '';
  return {
    error: (...args) => currentLevel >= levels.error && console.error(new Date().toISOString(), 'ERROR', prefix, ...args),
    warn:  (...args) => currentLevel >= levels.warn  && console.warn (new Date().toISOString(), 'WARN ', prefix, ...args),
    info:  (...args) => currentLevel >= levels.info  && console.log  (new Date().toISOString(), 'INFO ', prefix, ...args),
    debug: (...args) => currentLevel >= levels.debug && console.log  (new Date().toISOString(), 'DEBUG', prefix, ...args),
    child: (sub) => makeLogger(namespace ? `${namespace}:${sub}` : sub),
  };
}

const logger = makeLogger('HeadyConductor');
module.exports = logger;
module.exports.makeLogger = makeLogger;

'use strict';
/**
 * logger.js — Minimal structured logger for csl-output package.
 * Delegates to console with structured JSON output.
 * Matches the API of the main Heady™ logger.
 */

function _log(level, ...args) {
    const entry = {
        ts:    new Date().toISOString(),
        level,
        msg:   args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
    };
    if (level === 'error' || level === 'warn') {
        process.stderr.write(JSON.stringify(entry) + '\n');
    } else {
        process.stdout.write(JSON.stringify(entry) + '\n');
    }
}

const root = {
    debug: (...a) => _log('debug', ...a),
    info:  (...a) => _log('info',  ...a),
    warn:  (...a) => _log('warn',  ...a),
    error: (...a) => _log('error', ...a),
};

module.exports = {
    child:           (mod) => root,
    debug:           (...a) => root.debug(...a),
    info:            (...a) => root.info(...a),
    warn:            (...a) => root.warn(...a),
    error:           (...a) => root.error(...a),
    logNodeActivity: (node, ...msg) => root.info(`[${node}]`, ...msg),
    logError:        (node, ...msg) => root.error(`[${node}]`, ...msg),
    logSystem:       (...msg) => root.info(...msg),
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Shared Foundation — shared/index.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single entrypoint for all shared foundation modules.
 * Usage: const heady = require('./shared');
 *
 * © HeadySystems Inc.
 */

'use strict';

const phiMath = require('./phi-math');
const cslEngine = require('./csl-engine');
const sacredGeometry = require('./sacred-geometry');

module.exports = {
  ...phiMath,
  ...cslEngine,
  ...sacredGeometry,
};

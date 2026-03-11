const path = require('path');

const DATA_DIRECTORY = process.env.HEADYWEB_DATA_DIR || path.join(__dirname, '..', '.data');
const AUTH_SECRET = process.env.HEADYWEB_AUTH_SECRET || 'headyweb-dev-secret';
const TOKEN_TTL_MS = Number(process.env.HEADYWEB_TOKEN_TTL_MS || 1000 * 60 * 60 * 12);
const CODEBASE_ROOT = process.env.HEADYWEB_CODEBASE_ROOT || path.join(__dirname, '..', '..', '..');

module.exports = {
    DATA_DIRECTORY,
    AUTH_SECRET,
    TOKEN_TTL_MS,
    CODEBASE_ROOT,
};

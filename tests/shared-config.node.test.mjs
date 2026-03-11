import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modulePath = path.resolve(__dirname, '..', 'packages', 'shared', 'src', 'config.mjs');
const { parseOrigins, getConfig } = await import(pathToFileURL(modulePath).href);

test('parseOrigins returns an empty list when input is not provided', () => {
    assert.deepEqual(parseOrigins(), []);
});

test('getConfig uses localhost defaults in development when CORS_ORIGINS is empty', () => {
    const config = getConfig({ NODE_ENV: 'development' });

    assert.deepEqual(config.origins, ['http://localhost:3400', 'http://127.0.0.1:3400']);
});

test('getConfig does not allow localhost defaults in production when CORS_ORIGINS is empty', () => {
    const config = getConfig({ NODE_ENV: 'production' });

    assert.deepEqual(config.origins, []);
});

test('getConfig always prefers explicit CORS_ORIGINS values', () => {
    const config = getConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://headysystems.com, https://headyme.com '
    });

    assert.deepEqual(config.origins, ['https://headysystems.com', 'https://headyme.com']);
});

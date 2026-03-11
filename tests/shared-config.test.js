const { execFileSync } = require('node:child_process');
const path = require('node:path');

function loadConfigFromNode(env = {}) {
    const modulePath = path.resolve(__dirname, '..', 'packages', 'shared', 'src', 'config.mjs');
    const script = `
    import { getConfig, parseOrigins } from ${JSON.stringify(modulePath)};
    const parsed = parseOrigins(process.env.TEST_CORS_ORIGINS);
    const config = getConfig({
      NODE_ENV: process.env.TEST_NODE_ENV,
      CORS_ORIGINS: process.env.TEST_CORS_ORIGINS
    });
    process.stdout.write(JSON.stringify({ parsed, origins: config.origins }));
  `;

    const output = execFileSync('node', ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: {
            ...process.env,
            TEST_NODE_ENV: env.NODE_ENV,
            TEST_CORS_ORIGINS: env.CORS_ORIGINS
        }
    });

    return JSON.parse(output);
}

describe('packages/shared config', () => {
    test('parseOrigins returns an empty list when input is not provided', () => {
        const { parsed } = loadConfigFromNode({});
        expect(parsed).toEqual([]);
    });

    test('getConfig uses localhost defaults in development when CORS_ORIGINS is empty', () => {
        const { origins } = loadConfigFromNode({ NODE_ENV: 'development' });
        expect(origins).toEqual(['http://localhost:3400', 'http://127.0.0.1:3400']);
    });

    test('getConfig does not allow localhost defaults in production when CORS_ORIGINS is empty', () => {
        const { origins } = loadConfigFromNode({ NODE_ENV: 'production' });
        expect(origins).toEqual([]);
    });

    test('getConfig always prefers explicit CORS_ORIGINS values', () => {
        const { origins } = loadConfigFromNode({
            NODE_ENV: 'production',
            CORS_ORIGINS: 'https://headysystems.com, https://headyme.com '
        });

        expect(origins).toEqual(['https://headysystems.com', 'https://headyme.com']);
    });
});

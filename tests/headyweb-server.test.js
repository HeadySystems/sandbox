const request = require('supertest');
const { createApp, DEFAULT_TIMEOUT_MS } = require('../apps/headyweb/server');

describe('HeadyWeb server control-plane', () => {
    const fetchMock = jest.fn();

    beforeAll(() => {
        global.fetch = fetchMock;
    });

    beforeEach(() => {
        fetchMock.mockReset();
    });

    test('returns control-plane map and timeout', async () => {
        const app = createApp({ NODE_ENV: 'production', PORT: '3000' });
        const response = await request(app).get('/api/headyweb/control-plane');

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
        expect(response.body.auth).toBe('/api/headyweb/auth/login');
    });

    test('returns 503 when auth origin is unconfigured', async () => {
        const app = createApp({ NODE_ENV: 'production' });
        const response = await request(app)
            .post('/api/headyweb/auth/login')
            .send({ email: 'user@example.com', password: 'test' });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('Service origin is not configured');
    });

    test('proxies chat payload to upstream manager', async () => {
        fetchMock.mockResolvedValueOnce({
            status: 200,
            text: async () => JSON.stringify({ ok: true, reply: 'hello' }),
        });

        const app = createApp({ NODE_ENV: 'production', HEADY_CHAT_ORIGIN: 'https://manager.headysystems.com' });

        const response = await request(app)
            .post('/api/headyweb/chat')
            .send({ message: 'hello', workspaceId: 'abc' });

        expect(response.status).toBe(200);
        expect(response.body.reply).toBe('hello');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://manager.headysystems.com/api/brain/chat',
            expect.objectContaining({ method: 'POST' }),
        );
    });
});

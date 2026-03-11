const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
    resolveWorkspacePath,
    upsertSession,
    readWorkspace
} = require('../../src/headyweb/workspace-store');

describe('headyweb workspace store', () => {
    test('upsertSession persists chat state in workspace file', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'headyweb-workspace-'));
        const filePath = resolveWorkspacePath({ HEADY_DATA_DIR: tempDir });

        await upsertSession(filePath, 'session-alpha', { chat: [{ role: 'user', content: 'hi' }] });
        const workspace = await readWorkspace(filePath);

        expect(workspace.sessions['session-alpha'].chat).toHaveLength(1);
    });
});

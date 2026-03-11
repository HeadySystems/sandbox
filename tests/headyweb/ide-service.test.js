const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { writeFile, readFile, listFiles } = require('../../src/headyweb/ide-service');

describe('headyweb ide service', () => {
    test('writeFile + readFile operate inside root and listFiles returns entries', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'headyweb-ide-'));

        await writeFile(root, 'notes/hello.txt', 'hello world');
        const content = await readFile(root, 'notes/hello.txt');
        const list = await listFiles(root, 'notes');

        expect(content).toBe('hello world');
        expect(list.some((entry) => entry.name === 'hello.txt')).toBe(true);
    });
});

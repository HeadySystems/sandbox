const fs = require('node:fs/promises');
const path = require('node:path');

function resolveIdeRoot(env = process.env) {
    const configured = env.HEADYWEB_IDE_ROOT || process.cwd();
    return path.resolve(configured);
}

function assertWithinRoot(root, target) {
    const normalizedRoot = path.resolve(root);
    const normalizedTarget = path.resolve(target);
    if (!normalizedTarget.startsWith(normalizedRoot)) {
        throw new Error('path escapes IDE root');
    }
}

async function listFiles(root, relativeDir = '.') {
    const directory = path.resolve(root, relativeDir);
    assertWithinRoot(root, directory);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
        .filter((entry) => !entry.name.startsWith('.'))
        .map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? 'dir' : 'file',
            path: path.relative(root, path.resolve(directory, entry.name)) || '.'
        }));
}

async function readFile(root, relativePath) {
    const filePath = path.resolve(root, relativePath);
    assertWithinRoot(root, filePath);
    return fs.readFile(filePath, 'utf8');
}

async function writeFile(root, relativePath, content) {
    const filePath = path.resolve(root, relativePath);
    assertWithinRoot(root, filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return { path: path.relative(root, filePath), bytes: Buffer.byteLength(content, 'utf8') };
}

module.exports = {
    resolveIdeRoot,
    assertWithinRoot,
    listFiles,
    readFile,
    writeFile
};

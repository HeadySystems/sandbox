import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_IGNORE = new Set(['.git', 'node_modules', '.wrangler', 'artifacts', '.cache']);
const MAX_FILE_BYTES = 1024 * 512;
const MAX_TREE_ITEMS = 200;

export function resolveWorkspaceRoot(env = process.env) {
    return path.resolve(env.HEADY_WORKSPACE_ROOT || process.cwd());
}

export function sanitizeWorkspacePath(filePath) {
    const candidate = String(filePath || '').trim();
    if (!candidate) {
        throw new Error('path is required');
    }
    if (path.isAbsolute(candidate)) {
        throw new Error('absolute paths are not allowed');
    }
    const normalized = path.posix.normalize(candidate.replace(/\\/g, '/'));
    if (normalized === '..' || normalized.startsWith('../')) {
        throw new Error('path traversal is not allowed');
    }
    return normalized;
}

export function resolveSafePath(root, filePath) {
    const relativePath = sanitizeWorkspacePath(filePath);
    const fullPath = path.resolve(root, relativePath);
    if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
        throw new Error('path escapes workspace root');
    }
    return { fullPath, relativePath };
}

export async function readWorkspaceFile(root, filePath) {
    const { fullPath, relativePath } = resolveSafePath(root, filePath);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
        throw new Error('requested path is not a file');
    }
    if (stat.size > MAX_FILE_BYTES) {
        throw new Error(`file exceeds ${MAX_FILE_BYTES} bytes limit`);
    }
    const content = await fs.readFile(fullPath, 'utf8');
    return { path: relativePath, bytes: stat.size, content };
}

export async function writeWorkspaceFile(root, filePath, content) {
    const { fullPath, relativePath } = resolveSafePath(root, filePath);
    const next = String(content ?? '');
    const bytes = Buffer.byteLength(next, 'utf8');
    if (bytes > MAX_FILE_BYTES) {
        throw new Error(`file exceeds ${MAX_FILE_BYTES} bytes limit`);
    }
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, next, 'utf8');
    return { path: relativePath, bytes };
}

export async function listWorkspaceTree(root, prefix = '', limit = MAX_TREE_ITEMS) {
    const start = prefix ? resolveSafePath(root, prefix).fullPath : root;
    const rows = [];
    const queue = [start];
    while (queue.length > 0 && rows.length < limit) {
        const current = queue.shift();
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            if (DEFAULT_IGNORE.has(entry.name)) {
                continue;
            }
            const full = path.join(current, entry.name);
            const rel = path.relative(root, full) || '.';
            rows.push({ path: rel.replace(/\\/g, '/'), type: entry.isDirectory() ? 'dir' : 'file' });
            if (entry.isDirectory()) {
                queue.push(full);
            }
            if (rows.length >= limit) {
                break;
            }
        }
    }
    return rows;
}

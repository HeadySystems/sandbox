// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: apps/hive/src/state_store.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const fs = require('fs');
const path = require('path');

function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(lockPath, timeoutMs = 5000, retryMs = 50, staleMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            fs.mkdirSync(path.dirname(lockPath), { recursive: true });
            const fd = fs.openSync(lockPath, 'wx');
            fs.closeSync(fd);
            return true;
        } catch (err) {
            if (err && err.code !== 'EEXIST') {
                throw err;
            }
            try {
                const stat = fs.statSync(lockPath);
                const ageMs = Date.now() - stat.mtimeMs;
                if (ageMs > staleMs) {
                    fs.unlinkSync(lockPath);
                    continue;
                }
            } catch (_) {
                // ignore
            }
            sleepSync(retryMs);
        }
    }
    return false;
}

function releaseLock(lockPath) {
    try {
        fs.unlinkSync(lockPath);
    } catch (_) {
        // ignore
    }
}

function withFileLock(targetPath, fn, options = {}) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const lockPath = `${targetPath}.lock`;
    const timeoutMs = options.timeoutMs ?? 5000;
    const retryMs = options.retryMs ?? 50;
    const staleMs = options.staleMs ?? 30000;

    const locked = acquireLock(lockPath, timeoutMs, retryMs, staleMs);
    if (!locked) {
        throw new Error(`lock_timeout:${lockPath}`);
    }

    try {
        return fn();
    } finally {
        releaseLock(lockPath);
    }
}

function readJsonFile(filePath, fallback, options = {}) {
    const strict = options && options.strict === true;
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw);
    } catch (err) {
        if (strict) {
            throw err;
        }
        return fallback;
    }
}

function writeJsonAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(filePath);
    const tmpPath = path.join(dir, `.${base}.${process.pid}.tmp`);

    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    try {
        fs.renameSync(tmpPath, filePath);
    } catch (err) {
        try {
            fs.copyFileSync(tmpPath, filePath);
        } finally {
            try {
                fs.unlinkSync(tmpPath);
            } catch (_) {
                // ignore
            }
        }
        if (err && err.code && err.code !== 'EXDEV' && err.code !== 'EEXIST' && err.code !== 'EPERM') {
            throw err;
        }
    }
}

function updateJsonFile(filePath, fallback, updater) {
    return withFileLock(filePath, () => {
        const current = readJsonFile(filePath, fallback);
        const updated = updater(current);
        writeJsonAtomic(filePath, updated);
        return updated;
    });
}

function compareTaskIds(a, b) {
    const aNum = Number(a?.id);
    const bNum = Number(b?.id);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
    }

    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

function selectTask(queue, status) {
    const normalizedStatus = String(status ?? '').toUpperCase();
    const tasks = (Array.isArray(queue) ? queue : [])
        .filter(t => t && String(t.status ?? '').toUpperCase() === normalizedStatus)
        .slice()
        .sort(compareTaskIds);
    return tasks[0] || null;
}

module.exports = {
    withFileLock,
    readJsonFile,
    writeJsonAtomic,
    updateJsonFile,
    selectTask,
};

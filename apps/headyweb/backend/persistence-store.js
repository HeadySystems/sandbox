const fs = require('fs');
const path = require('path');
const { DATA_DIRECTORY } = require('./config');

function ensureDirectory(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJson(filePath, data) {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

class PersistenceStore {
    constructor() {
        ensureDirectory(DATA_DIRECTORY);
        this.usersPath = path.join(DATA_DIRECTORY, 'users.json');
        this.workspaceDirectory = path.join(DATA_DIRECTORY, 'workspaces');
        ensureDirectory(this.workspaceDirectory);
    }

    getUsers() {
        return readJson(this.usersPath, []);
    }

    saveUsers(users) {
        writeJson(this.usersPath, users);
    }

    getWorkspace(userId) {
        const workspacePath = path.join(this.workspaceDirectory, `${userId}.json`);
        return readJson(workspacePath, {
            userId,
            vectors: [],
            chats: [],
            updatedAt: new Date().toISOString(),
        });
    }

    saveWorkspace(userId, workspace) {
        const workspacePath = path.join(this.workspaceDirectory, `${userId}.json`);
        writeJson(workspacePath, { ...workspace, updatedAt: new Date().toISOString() });
    }
}

module.exports = {
    PersistenceStore,
};

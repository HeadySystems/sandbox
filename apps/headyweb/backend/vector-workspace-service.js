function stringToVector(text, dimensions = 64) {
    const vector = Array.from({ length: dimensions }, () => 0);
    const value = String(text || '');
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        const slot = index % dimensions;
        vector[slot] += (code % 31) / 31;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, element) => sum + element * element, 0)) || 1;
    return vector.map((element) => element / magnitude);
}

function cosineSimilarity(left, right) {
    const length = Math.min(left.length, right.length);
    let total = 0;
    for (let index = 0; index < length; index += 1) {
        total += left[index] * right[index];
    }
    return total;
}

class VectorWorkspaceService {
    constructor(store) {
        this.store = store;
    }

    upsertVector(userId, { id, text, metadata }) {
        const workspace = this.store.getWorkspace(userId);
        const vectorId = id || `vec-${Date.now()}`;
        const embedding = stringToVector(text);

        const nextRecord = {
            id: vectorId,
            text: String(text || ''),
            metadata: metadata || {},
            embedding,
            updatedAt: new Date().toISOString(),
        };

        const existingIndex = workspace.vectors.findIndex((record) => record.id === vectorId);
        if (existingIndex >= 0) {
            workspace.vectors[existingIndex] = nextRecord;
        } else {
            workspace.vectors.push(nextRecord);
        }

        this.store.saveWorkspace(userId, workspace);
        return nextRecord;
    }

    listVectors(userId) {
        return this.store.getWorkspace(userId).vectors;
    }

    search(userId, query, limit = 5) {
        const workspace = this.store.getWorkspace(userId);
        const queryVector = stringToVector(query);

        return workspace.vectors
            .map((record) => ({
                ...record,
                score: cosineSimilarity(queryVector, record.embedding),
            }))
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    }

    appendChat(userId, entry) {
        const workspace = this.store.getWorkspace(userId);
        workspace.chats.push({ ...entry, timestamp: new Date().toISOString() });
        if (workspace.chats.length > 200) {
            workspace.chats = workspace.chats.slice(-200);
        }
        this.store.saveWorkspace(userId, workspace);
    }
}

module.exports = {
    VectorWorkspaceService,
};

/**
 * @fileoverview CSL Router - Cosine Similarity Layer routing engine
 */
import { CSL_THRESHOLDS, cslGate } from '../shared/phi-math.js';

export class CSLRouter {
  constructor(embedFn) {
    this._embedFn = embedFn;
    this._swarmEmbeddings = new Map();
    this._embeddingCache = new Map();
  }

  /**
   * Register swarm with domain embedding
   */
  async registerSwarm(swarmId, domain) {
    const embedding = await this._embedFn(domain);
    this._swarmEmbeddings.set(swarmId, { domain, embedding });
  }

  /**
   * Route task to best swarm
   * @returns {{ swarmId: string, score: number, strategy: string }}
   */
  async route(task) {
    // Get task embedding
    const taskEmb = await this._getTaskEmbedding(task);

    // Compute similarities
    const scores = [];
    for (const [swarmId, data] of this._swarmEmbeddings) {
      const score = this._cosineSimilarity(taskEmb, data.embedding);
      scores.push({ swarmId, score, domain: data.domain });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    // Apply CSL gates
    if (cslGate(best.score, CSL_THRESHOLDS.HIGH)) {
      return { ...best, strategy: 'csl-high' };
    } else if (cslGate(best.score, CSL_THRESHOLDS.MEDIUM)) {
      return { ...best, strategy: 'csl-medium' };
    } else if (cslGate(best.score, CSL_THRESHOLDS.LOW)) {
      return { ...best, strategy: 'csl-low' };
    } else {
      return { swarmId: null, score: best.score, strategy: 'fallback' };
    }
  }

  async _getTaskEmbedding(task) {
    const text = task.description || task.payload?.text || '';
    const cacheKey = this._hash(text);

    if (this._embeddingCache.has(cacheKey)) {
      return this._embeddingCache.get(cacheKey);
    }

    const embedding = await this._embedFn(text);
    this._embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  _cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }
}

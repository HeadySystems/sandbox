'use strict';

/**
 * HEADY™ Search Service
 * HeadySystems Inc. - Proprietary
 * 
 * Hybrid search service combining full-text and vector search
 * with CSL-gated result ranking
 */

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const TextIndex = require('./text-index');
const VectorSearch = require('./vector-search');
const HybridRanker = require('./hybrid-ranker');

// φ-scaled constants
const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// CSL Gates
const CSL = {
  SUPPRESS: 0.236,
  INCLUDE: 0.382,
  BOOST: 0.618,
  INJECT: 0.718,
  HIGH: 0.882,
  CRITICAL: 0.927
};

// Configuration
const PORT = process.env.PORT || 3391;
const VERSION = '1.0.0';

// Initialize services
const app = express();
const textIndex = new TextIndex();
const vectorSearch = new VectorSearch();
const hybridRanker = new HybridRanker({
  k: 100,
  includeGate: CSL.INCLUDE,
  boostMultiplier: PHI,
  domainBoost: PSI
});

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const stats = {
    service: 'heady-search-service',
    version: VERSION,
    status: 'operational',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    indices: {
      text: textIndex.getStats(),
      vector: vectorSearch.getStats()
    }
  };

  res.json(stats);
});

/**
 * POST /search
 * Hybrid search with text query and optional vector embedding
 * 
 * Request body:
 * {
 *   "query": "search query text",
 *   "embedding": [Float64Array 384-dim optional],
 *   "domain": "optional domain filter",
 *   "textWeight": 0.5,
 *   "vectorWeight": 0.5,
 *   "limit": 13,
 *   "includeMetadata": true
 * }
 */
app.post('/search', (req, res) => {
  try {
    const {
      query,
      embedding = null,
      domain = null,
      textWeight = 0.5,
      vectorWeight = 0.5,
      limit = FIB[7],
      includeMetadata = true,
      advanced = false
    } = req.body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Query must be a non-empty string'
      });
    }

    const queryTrimmed = query.trim();

    // Perform text search
    const textResults = textIndex.search(queryTrimmed, { limit: limit * 2 });

    // Prepare vector results
    let vectorResults = [];
    if (embedding && Array.isArray(embedding) && embedding.length === 384) {
      const vector = new Float64Array(embedding);
      vectorResults = vectorSearch.search(vector, {
        k: limit * 2,
        threshold: CSL.SUPPRESS
      });
    }

    // Merge results using hybrid ranker
    const ranker = new HybridRanker({
      k: 100,
      includeGate: CSL.INCLUDE,
      boostMultiplier: PHI,
      domainBoost: PSI,
      textWeight: textWeight,
      vectorWeight: vectorWeight
    });

    let mergedResults;
    if (advanced) {
      mergedResults = ranker.advancedMerge(textResults, vectorResults, {
        domain: domain,
        limit: limit
      });
    } else {
      mergedResults = ranker.merge(textResults, vectorResults, {
        domain: domain,
        limit: limit
      });
    }

    // Format response
    const response = {
      success: true,
      query: queryTrimmed,
      resultCount: mergedResults.length,
      results: mergedResults.map(result => {
        const formatted = {
          docId: result.docId,
          score: result.score,
          normalizedScore: result.score / (CSL.CRITICAL + 0.1),
          metadata: includeMetadata ? result.metadata : undefined,
          inBoth: result.inBoth
        };

        if (result.textScore !== null) {
          formatted.textScore = result.textScore;
        }
        if (result.vectorScore !== null) {
          formatted.vectorScore = result.vectorScore;
        }

        return formatted;
      }),
      domain: domain,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * POST /index
 * Index a new document with text content and optional vector embedding
 * 
 * Request body:
 * {
 *   "docId": "unique-id or auto-generated",
 *   "content": "document content to index",
 *   "metadata": {
 *     "domain": "optional domain",
 *     "tags": ["tag1", "tag2"],
 *     "custom": "metadata"
 *   },
 *   "embedding": [Float64Array 384-dim optional],
 *   "tags": ["domain1", "domain2"]
 * }
 */
app.post('/index', (req, res) => {
  try {
    let {
      docId = null,
      content,
      metadata = {},
      embedding = null,
      tags = []
    } = req.body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid content',
        message: 'Content must be a non-empty string'
      });
    }

    // Generate docId if not provided
    if (!docId) {
      docId = uuidv4();
    }

    // Add tags to metadata
    const enrichedMetadata = {
      ...metadata,
      tags: tags,
      indexed: new Date().toISOString()
    };

    // Index text content
    textIndex.indexDocument(docId, content, enrichedMetadata);

    // Index vector embedding if provided
    if (embedding && Array.isArray(embedding) && embedding.length === 384) {
      const vector = new Float64Array(embedding);
      vectorSearch.addVector(docId, vector, enrichedMetadata);
    }

    const stats = {
      textDocs: textIndex.getStats().documentCount,
      vectorDocs: vectorSearch.getStats().vectorCount
    };

    res.status(201).json({
      success: true,
      docId: docId,
      indexed: {
        text: true,
        vector: !!(embedding && embedding.length === 384)
      },
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({
      error: 'Indexing failed',
      message: error.message
    });
  }
});

/**
 * DELETE /index/:docId
 * Remove document from indices
 */
app.delete('/index/:docId', (req, res) => {
  try {
    const { docId } = req.params;

    if (!docId || docId.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid docId',
        message: 'DocId must be non-empty'
      });
    }

    textIndex.deleteDocument(docId);
    vectorSearch.removeVector(docId);

    res.json({
      success: true,
      docId: docId,
      deleted: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'Deletion failed',
      message: error.message
    });
  }
});

/**
 * GET /suggest
 * Autocomplete suggestions based on indexed terms
 * 
 * Query params:
 * ?prefix=search&limit=8
 */
app.get('/suggest', (req, res) => {
  try {
    const { prefix = '', limit = FIB[6] } = req.query;

    if (!prefix || typeof prefix !== 'string') {
      return res.json({
        suggestions: [],
        prefix: prefix,
        count: 0
      });
    }

    const suggestions = textIndex.getAutocomplete(prefix, {
      limit: Math.min(parseInt(limit) || FIB[6], 50)
    });

    res.json({
      suggestions: suggestions,
      prefix: prefix,
      count: suggestions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({
      error: 'Suggestion failed',
      message: error.message
    });
  }
});

/**
 * POST /phrase-search
 * Search for exact phrase matches
 * 
 * Request body:
 * {
 *   "phrase": "exact phrase to find",
 *   "limit": 13
 * }
 */
app.post('/phrase-search', (req, res) => {
  try {
    const { phrase, limit = FIB[7] } = req.body;

    if (!phrase || typeof phrase !== 'string' || phrase.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid phrase',
        message: 'Phrase must be a non-empty string'
      });
    }

    const results = textIndex.phraseSearch(phrase.trim(), { limit });

    res.json({
      success: true,
      phrase: phrase.trim(),
      resultCount: results.length,
      results: results.map(r => ({
        docId: r.docId,
        score: r.score,
        position: r.position,
        metadata: r.document.metadata
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Phrase search error:', error);
    res.status(500).json({
      error: 'Phrase search failed',
      message: error.message
    });
  }
});

/**
 * POST /vector-search
 * Pure vector similarity search
 * 
 * Request body:
 * {
 *   "embedding": [Float64Array 384-dim],
 *   "k": 13,
 *   "threshold": 0.236
 * }
 */
app.post('/vector-search', (req, res) => {
  try {
    const { embedding, k = FIB[7], threshold = CSL.SUPPRESS } = req.body;

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 384) {
      return res.status(400).json({
        error: 'Invalid embedding',
        message: 'Embedding must be a 384-dimensional array'
      });
    }

    const vector = new Float64Array(embedding);
    const results = vectorSearch.search(vector, {
      k: k,
      threshold: threshold
    });

    res.json({
      success: true,
      resultCount: results.length,
      results: results.map(r => ({
        docId: r.docId,
        score: r.score,
        metadata: r.metadata
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Vector search error:', error);
    res.status(500).json({
      error: 'Vector search failed',
      message: error.message
    });
  }
});

/**
 * POST /vector-batch
 * Add multiple vectors in batch
 * 
 * Request body:
 * {
 *   "vectors": [
 *     {
 *       "docId": "id",
 *       "embedding": [Float64Array 384-dim],
 *       "metadata": {...}
 *     }
 *   ]
 * }
 */
app.post('/vector-batch', (req, res) => {
  try {
    const { vectors } = req.body;

    if (!Array.isArray(vectors)) {
      return res.status(400).json({
        error: 'Invalid vectors',
        message: 'Vectors must be an array'
      });
    }

    let added = 0;
    const errors = [];

    vectors.forEach((item, idx) => {
      try {
        if (item.embedding && item.embedding.length === 384) {
          const vector = new Float64Array(item.embedding);
          vectorSearch.addVector(
            item.docId,
            vector,
            item.metadata || {}
          );
          added++;
        } else {
          errors.push(`Item ${idx}: invalid embedding dimension`);
        }
      } catch (err) {
        errors.push(`Item ${idx}: ${err.message}`);
      }
    });

    res.json({
      success: true,
      added: added,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      stats: vectorSearch.getStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Vector batch error:', error);
    res.status(500).json({
      error: 'Batch processing failed',
      message: error.message
    });
  }
});

/**
 * GET /stats
 * Get comprehensive index statistics
 */
app.get('/stats', (req, res) => {
  try {
    const textStats = textIndex.getStats();
    const vectorStats = vectorSearch.getStats();

    const rankerStats = {
      k: 100,
      includeGate: CSL.INCLUDE,
      boostMultiplier: PHI,
      domainBoost: PSI
    };

    res.json({
      service: 'heady-search-service',
      version: VERSION,
      uptime: process.uptime(),
      indices: {
        text: textStats,
        vector: vectorStats
      },
      ranker: rankerStats,
      constants: {
        PHI: PHI,
        PSI: PSI,
        FIB: FIB,
        CSL: CSL
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: 'Stats retrieval failed',
      message: error.message
    });
  }
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         HEADY™ Search Service v${VERSION}                     ║
║         HeadySystems Inc. - Proprietary                     ║
║════════════════════════════════════════════════════════════╝
  Status:     Operational
  Port:       ${PORT}
  Timestamp:  ${new Date().toISOString()}
  
  φ-scaled Constants:
    PHI:      ${PHI}
    PSI:      ${PSI}
  
  CSL Gates:
    SUPPRESS:  ${CSL.SUPPRESS}
    INCLUDE:   ${CSL.INCLUDE}
    BOOST:     ${CSL.BOOST}
    INJECT:    ${CSL.INJECT}
    HIGH:      ${CSL.HIGH}
    CRITICAL:  ${CSL.CRITICAL}
  
  Endpoints:
    POST   /search          - Hybrid search
    POST   /index           - Index document
    DELETE /index/:docId    - Remove document
    GET    /suggest         - Autocomplete
    POST   /phrase-search   - Phrase search
    POST   /vector-search   - Vector search
    POST   /vector-batch    - Batch add vectors
    GET    /stats           - Statistics
    GET    /health          - Health check
╚════════════════════════════════════════════════════════════╝
  `);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;

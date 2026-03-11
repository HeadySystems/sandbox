# HEADY™ Search Service

**Sovereign AI Operating System**  
HeadySystems Inc. - Eric Haywood, Founder  
Proprietary Software

## Overview

The HEADY™ Search Service is a production-grade hybrid search engine combining full-text and vector similarity search with CSL-gated result ranking. It provides a unified search interface supporting multiple indexing and retrieval strategies.

## Architecture

### Core Components

1. **TextIndex** (`src/text-index.js`)
   - Full-text search engine with TF-IDF scoring
   - Porter stemming for morphological analysis
   - Inverted index for efficient retrieval
   - Phrase matching support
   - Stop word removal
   - Capacity: FIB[13] = 233,000 documents

2. **VectorSearch** (`src/vector-search.js`)
   - In-memory vector similarity search
   - 384-dimensional embeddings
   - Cosine similarity scoring
   - Linear scan with early termination
   - Multi-vector ensemble support
   - Range search capability

3. **HybridRanker** (`src/hybrid-ranker.js`)
   - Reciprocal Rank Fusion (RRF) algorithm
   - CSL-gated filtering and ranking
   - Domain-aware re-ranking
   - Multi-level gating thresholds
   - Boost multipliers for ensemble hits

4. **Express Server** (`src/index.js`)
   - RESTful API with 9 endpoints
   - Request logging and monitoring
   - Health checks and statistics
   - Graceful shutdown handling

## φ-Scaled Constants

All numeric constants use φ (golden ratio) scaling for dimensional consistency:

```javascript
PHI = 1.618033988749895  // Golden ratio
PSI = 1 / PHI = 0.618033988749895  // Inverse golden ratio
FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]
```

**CSL Gates** (Cognitive Semantic Limits):
- `SUPPRESS` (0.236) — Below minimum threshold, suppressed from results
- `INCLUDE` (0.382) — Minimum inclusion threshold
- `BOOST` (0.618) — Enhanced results (PHI)
- `INJECT` (0.718) — High-confidence results
- `HIGH` (0.882) — Very high confidence
- `CRITICAL` (0.927) — Critical/top-tier results

## API Endpoints

### Health & Monitoring

**GET /health**
- Health check with uptime and index statistics
- Response: Service status, version, index metrics

**GET /stats**
- Comprehensive service statistics
- Returns: Text/vector index stats, ranker configuration, constants

### Search Operations

**POST /search** — Hybrid Search
```json
{
  "query": "search query text",
  "embedding": [/* 384-dim Float64Array, optional */],
  "domain": "optional domain filter",
  "textWeight": 0.5,
  "vectorWeight": 0.5,
  "limit": 13,
  "includeMetadata": true,
  "advanced": false
}
```
Returns ranked results with CSL-gated filtering.

**POST /phrase-search** — Phrase Search
```json
{
  "phrase": "exact phrase to find",
  "limit": 13
}
```
Finds exact phrase matches with position information.

**POST /vector-search** — Vector Similarity
```json
{
  "embedding": [/* 384-dim Float64Array */],
  "k": 13,
  "threshold": 0.236
}
```
Pure vector similarity search with cosine distance.

### Indexing Operations

**POST /index** — Index Document
```json
{
  "docId": "unique-id or auto-generated",
  "content": "document content to index",
  "metadata": {
    "domain": "optional domain",
    "tags": ["tag1", "tag2"],
    "custom": "metadata"
  },
  "embedding": [/* 384-dim Float64Array, optional */],
  "tags": ["domain1", "domain2"]
}
```
Indexes text and/or vector content.

**POST /vector-batch** — Batch Vector Indexing
```json
{
  "vectors": [
    {
      "docId": "id",
      "embedding": [/* 384-dim Float64Array */],
      "metadata": {...}
    }
  ]
}
```
Efficiently index multiple vectors in one request.

**DELETE /index/:docId** — Remove Document
- Removes document from both text and vector indices
- Returns: Success confirmation

### Utility Endpoints

**GET /suggest** — Autocomplete Suggestions
- Query params: `?prefix=search&limit=8`
- Returns: Matching stemmed terms up to limit (default FIB[6]=8)

## Installation & Running

### Docker

Build:
```bash
docker build -t heady-search-service:latest .
```

Run:
```bash
docker run -p 3391:3391 heady-search-service:latest
```

### Local Development

Install dependencies:
```bash
npm install
```

Start server:
```bash
npm start
```

Development with auto-reload:
```bash
npm run dev
```

## Technical Details

### TF-IDF Scoring

The text search engine implements classical TF-IDF scoring:

```
Score = Σ(TF × IDF) / √document_length
```

Where:
- **TF** = Term frequency in document
- **IDF** = log(total_documents / document_frequency)

### Cosine Similarity

Vector search uses normalized cosine similarity:

```
similarity = dot_product(normalized_v1, normalized_v2)
```

Range: [0, 1] where 1 = identical vectors

### Reciprocal Rank Fusion

Results from text and vector searches are merged using RRF:

```
RRF_score = Σ(1 / (k + rank + 1)) × weight
```

Where k=100 (window size) by default.

### CSL Gating

Results pass through multi-level CSL gates based on their combined scores:

1. **Filtering** — Only results ≥ INCLUDE gate (0.382) pass
2. **Boosting** — Results in both result sets × PHI (1.618)
3. **Domain Matching** — Domain matches × (1 + PSI)
4. **Categorization** — Results stratified by CSL thresholds

## Scaling & Performance

- **Memory**: ~8MB per 1000 384-dim vectors
- **Text Index**: Supports up to 233,000 documents (FIB[13])
- **Vector Search**: Linear scan (O(n)) with early termination
- **Default Results**: Top 13 (FIB[7])

## Constants Summary

| Constant | Value | Purpose |
|----------|-------|---------|
| PHI | 1.618 | Golden ratio boost multiplier |
| PSI | 0.618 | Domain/inverse boost |
| FIB[7] | 13 | Default result limit |
| FIB[6] | 8 | Default suggestion limit |
| FIB[13] | 233k | Max documents |
| VECTOR_DIM | 384 | Embedding dimension |
| PORT | 3391 | Service port |

## Author

HeadySystems Inc.  
Eric Haywood, Founder  
Proprietary Software - All Rights Reserved

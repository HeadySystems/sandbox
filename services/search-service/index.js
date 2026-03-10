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
// ║  FILE: services/search-service/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// Fibonacci rate limiting: 233 max requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 233,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const dbUrl = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: dbUrl,
});

// Structured JSON Logging
const logger = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'INFO', msg, ...data })),
  error: (msg, error) => console.log(JSON.stringify({ level: 'ERROR', msg, error: error.message || error }))
};

const CSL_GATES = { include: 0.382, boost: 0.618, inject: 0.718 };

app.post('/api/search', async (req, res) => {
  const { query, embedding } = req.body;

  if (!query) {
    logger.error('Missing search query');
    return res.status(400).json({ error: 'Missing search query', code: 'HEADY-SEARCH-001' });
  }

  try {
    let results;
    if (embedding) {
        const sql = `
          SELECT id, content, (embedding <-> $1) AS vector_distance,
          ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) AS text_rank
          FROM heady_memory
          WHERE (embedding <-> $1) < $3
          ORDER BY vector_distance ASC
          LIMIT 34
        `;
        const { rows } = await pool.query(sql, [JSON.stringify(embedding), query, CSL_GATES.include]);
        results = rows;
    } else {
        const sql = `
          SELECT id, content,
          ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS text_rank
          FROM heady_memory
          WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
          ORDER BY text_rank DESC
          LIMIT 34
        `;
        const { rows } = await pool.query(sql, [query]);
        results = rows;
    }

    logger.info('Performing hybrid search', { query, csl_gate: CSL_GATES.include });

    res.status(200).json({ status: 'success', results });
  } catch (error) {
    logger.error('Search failed', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).send(JSON.stringify({ status: 'OK', service: 'search-service' }));
});

const PORT = process.env.PORT || 3312;
app.listen(PORT, () => {
  logger.info(`search-service running on port ${PORT}`);
});

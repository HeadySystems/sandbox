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
// ║  FILE: services/auth-session-server/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// Fibonacci rate limiting: 233 max requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 233,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Structured JSON Logging
const logger = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'INFO', msg, ...data })),
  error: (msg, error) => console.log(JSON.stringify({ level: 'ERROR', msg, error: error.message || error }))
};

app.post('/api/auth/sessionLogin', (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    logger.error('No ID token provided');
    return res.status(401).send('UNAUTHORIZED REQUEST');
  }

  // Set session cookie
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  const options = { maxAge: expiresIn, httpOnly: true, secure: true, sameSite: 'strict', path: '/' };
  // Bind to domain using __Host- prefix.
  res.cookie('__Host-heady_session', idToken, options);
  logger.info('Session login successful');
  res.status(200).send(JSON.stringify({ status: 'success' }));
});

app.post('/api/auth/sessionLogout', (req, res) => {
  res.clearCookie('__Host-heady_session', { path: '/' });
  logger.info('Session logout successful');
  res.status(200).send(JSON.stringify({ status: 'success' }));
});

app.get('/api/health', (req, res) => {
  res.status(200).send(JSON.stringify({ status: 'OK', service: 'auth-session-server' }));
});

const PORT = process.env.PORT || 3311;
app.listen(PORT, () => {
  logger.info(`auth-session-server running on port ${PORT}`);
});

#!/usr/bin/env node
/**
 * Heady™ Site Generator & Deployer
 * Generates branded pages for all 59 Cloudflare domains and deploys via wrangler pages.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITES_DIR = path.join(__dirname, 'services/heady-web/sites');

// ═══════════════════════════════════════════════════════════════════════
// Domain categorization — ALL 59 Cloudflare zones
// ═══════════════════════════════════════════════════════════════════════
const DOMAINS = {
    // ── PRODUCT SITES (public-facing, branded landing pages) ──────────
    product: {
        'headyme.com': { name: 'HeadyMe', tagline: 'Your Personal AI Cloud', icon: '🧠', color: '#6C5CE7', geo: 'Flower of Life', dir: 'headyme' },
        'headysystems.com': { name: 'HeadySystems', tagline: 'Enterprise AI Platform', icon: '⚡', color: '#00B894', geo: 'Metatrons Cube', dir: 'headysystems' },
        'headyconnection.org': { name: 'HeadyConnection', tagline: 'AI for Social Impact', icon: '🤝', color: '#E17055', geo: 'Seed of Life', dir: 'headyconnection-org' },
        'headyconnection.com': { name: 'HeadyConnection', tagline: 'AI for Social Impact', icon: '🤝', color: '#E17055', geo: 'Seed of Life', dir: 'headyconnection-com' },
        'headybuddy.org': { name: 'HeadyBuddy', tagline: 'Your AI Companion', icon: '🐝', color: '#FDCB6E', geo: 'Vesica Piscis', dir: 'headybuddy' },
        'heady-ai.com': { name: 'HeadyAI', tagline: 'AI Research & Innovation', icon: '🔬', color: '#A29BFE', geo: 'Sri Yantra', dir: 'heady-ai' },
        'headyos.com': { name: 'HeadyOS', tagline: 'The AI Operating System', icon: '💠', color: '#00CEC9', geo: 'Torus', dir: 'headyos' },
        'headyfinance.com': { name: 'HeadyFinance', tagline: 'AI Trading Intelligence', icon: '📈', color: '#2ECC71', geo: 'Vesica Piscis', dir: 'headyfinance' },
        'headymusic.com': { name: 'HeadyMusic', tagline: 'AI Music & Creative Tools', icon: '🎵', color: '#E84393', geo: 'Fibonacci Spiral', dir: 'headymusic' },
        'headybot.com': { name: 'HeadyBot', tagline: 'Intelligent Chatbot Interface', icon: '🤖', color: '#0984E3', geo: 'Hexagon', dir: 'headybot' },
        'headymcp.com': { name: 'HeadyMCP', tagline: 'MCP Protocol Hub & Marketplace', icon: '🔌', color: '#6C5CE7', geo: 'Octahedron', dir: 'headymcp' },
        'headyio.com': { name: 'HeadyIO', tagline: 'Developer Portal & SDK', icon: '💻', color: '#2D3436', geo: 'Icosahedron', dir: 'headyio' },
        'headyapi.com': { name: 'HeadyAPI', tagline: 'Unified AI Gateway', icon: '🔗', color: '#636E72', geo: 'Tetrahedron', dir: 'headyapi' },
        'headycloud.com': { name: 'HeadyCloud', tagline: 'Cloud Infrastructure Portal', icon: '☁️', color: '#74B9FF', geo: 'Dodecahedron', dir: 'headycloud' },
        'headystore.com': { name: 'HeadyStore', tagline: 'AI Marketplace & Store', icon: '🏪', color: '#FF7675', geo: 'Golden Spiral', dir: 'headystore' },
        'headyex.com': { name: 'HeadyEx', tagline: 'Data Exchange Platform', icon: '📊', color: '#00B894', geo: 'Fibonacci Spiral', dir: 'headyex' },
    },

    // ── INTERNAL TOOL UIs (functional dashboards) ─────────────────────
    tool: {
        'headyagent.com': { name: 'HeadyAgent', tagline: 'Agent Management Console', icon: '🕵️', color: '#6C5CE7' },
        'headycreator.com': { name: 'HeadyCreator', tagline: 'Content Creator Studio', icon: '🎨', color: '#E84393' },
        'headystudio.com': { name: 'HeadyStudio', tagline: 'Creative AI Studio', icon: '🎬', color: '#A29BFE' },
        'headytube.com': { name: 'HeadyTube', tagline: 'Video & Media Platform', icon: '📺', color: '#D63031' },
        'headysense.com': { name: 'HeadySense', tagline: 'Monitoring & Observability', icon: '📡', color: '#00CEC9' },
        'headydb.com': { name: 'HeadyDB', tagline: 'Database Admin Console', icon: '🗄️', color: '#636E72' },
        'headysecure.com': { name: 'HeadySecure', tagline: 'Security Dashboard', icon: '🔒', color: '#2D3436' },
        'headyvault.com': { name: 'HeadyVault', tagline: 'Secrets & Key Management', icon: '🔐', color: '#2D3436' },
        'headycore.com': { name: 'HeadyCore', tagline: 'Core Services Dashboard', icon: '⚙️', color: '#636E72' },
        'headycheck.com': { name: 'HeadyCheck', tagline: 'Health Monitor', icon: '✅', color: '#00B894' },
        'headysafe.com': { name: 'HeadySafe', tagline: 'Safety & Compliance', icon: '🛡️', color: '#0984E3' },
        'headykey.com': { name: 'HeadyKey', tagline: 'Key & Identity Manager', icon: '🔑', color: '#FDCB6E' },
        'headyu.com': { name: 'HeadyU', tagline: 'Learning & Education', icon: '🎓', color: '#6C5CE7' },
        'headymx.com': { name: 'HeadyMX', tagline: 'Email & Messaging', icon: '📧', color: '#00CEC9' },
        'headytxt.com': { name: 'HeadyTxt', tagline: 'Text & Document Service', icon: '📝', color: '#636E72' },
        'headymd.com': { name: 'HeadyMD', tagline: 'Health AI Services', icon: '⚕️', color: '#00B894' },
    },

    // ── RESERVE/PARKED (branded holding pages → redirect to headyme.com) ──
    reserve: {
        '1ime1.com': { name: '1IME1' },
        '1imi1.com': { name: '1IMI1' },
        'headyadvisor.com': { name: 'HeadyAdvisor' },
        'headyaid.com': { name: 'HeadyAid' },
        'headyarchive.com': { name: 'HeadyArchive' },
        'headyassist.com': { name: 'HeadyAssist' },
        'headyassure.com': { name: 'HeadyAssure' },
        'headybare.com': { name: 'HeadyBare' },
        'headybet.com': { name: 'HeadyBet' },
        'headybio.com': { name: 'HeadyBio' },
        'headycorrections.com': { name: 'HeadyCorrections' },
        'headycrypt.com': { name: 'HeadyCrypt' },
        'headyfed.com': { name: 'HeadyFed' },
        'headyfield.com': { name: 'HeadyField' },
        'headygov.com': { name: 'HeadyGov' },
        'headyhome.com': { name: 'HeadyHome' },
        'headykiosk.com': { name: 'HeadyKiosk' },
        'headylegal.com': { name: 'HeadyLegal' },
        'headylibrary.com': { name: 'HeadyLibrary' },
        'headymanufacturing.com': { name: 'HeadyManufacturing' },
        'headyplus.com': { name: 'HeadyPlus' },
        'headyrx.com': { name: 'HeadyRx' },
        'headyship.com': { name: 'HeadyShip' },
        'headystate.com': { name: 'HeadyState' },
        'headyusa.com': { name: 'HeadyUSA' },
        'openmindsplace.com': { name: 'Open Minds Place' },
        'openmindstop.com': { name: 'Open Minds Top' },
    }
};

// ═══════════════════════════════════════════════════════════════════════
// HTML Generators
// ═══════════════════════════════════════════════════════════════════════

function generateProductPage(domain, info) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name}™ — ${info.tagline}</title>
  <meta name="description" content="${info.name}™ — ${info.tagline}. Part of the Heady™ AI ecosystem by HeadySystems Inc.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: ${info.color};
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #1e1e2a;
      --text: #e8e8f0;
      --text-dim: #8888a0;
      --glow: ${info.color}40;
    }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Sacred Geometry Background */
    .sacred-bg {
      position: fixed; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse at 20% 50%, ${info.color}08 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, ${info.color}05 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, #6C5CE708 0%, transparent 40%);
    }
    .sacred-bg::before {
      content: ''; position: absolute; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='28' fill='none' stroke='%23ffffff' stroke-opacity='0.015' stroke-width='0.5'/%3E%3C/svg%3E");
      background-size: 60px 60px;
    }

    /* Navigation */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      background: rgba(10, 10, 15, 0.8);
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-brand { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; }
    .nav-icon { font-size: 1.5rem; }
    .nav-name { font-weight: 700; font-size: 1.1rem; color: var(--text); }
    .nav-tm { font-size: 0.6rem; vertical-align: super; color: var(--text-dim); }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--text-dim); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
    .nav-links a:hover { color: var(--text); }
    .nav-cta {
      background: var(--primary); color: #fff !important; padding: 0.5rem 1.25rem;
      border-radius: 8px; font-weight: 600; transition: all 0.3s;
    }
    .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 20px var(--glow); }

    /* Hero */
    .hero {
      position: relative; z-index: 1;
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
      padding: 6rem 2rem 4rem;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: var(--surface); border: 1px solid var(--border);
      padding: 0.4rem 1rem; border-radius: 100px;
      font-size: 0.8rem; color: var(--text-dim); margin-bottom: 2rem;
    }
    .hero-badge-dot { width: 6px; height: 6px; background: #2ECC71; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .hero-icon { font-size: 4rem; margin-bottom: 1.5rem; filter: drop-shadow(0 0 30px var(--glow)); }
    h1 {
      font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 900;
      line-height: 1.1; margin-bottom: 1.5rem;
      background: linear-gradient(135deg, var(--text) 30%, var(--primary) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: clamp(1.1rem, 2.5vw, 1.4rem); color: var(--text-dim);
      max-width: 600px; line-height: 1.6; margin-bottom: 2.5rem;
    }
    .hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.85rem 2rem; border-radius: 12px; font-weight: 600;
      font-size: 1rem; text-decoration: none; transition: all 0.3s;
      cursor: pointer; border: none;
    }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px var(--glow); }
    .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-ghost:hover { border-color: var(--primary); background: ${info.color}10; }

    /* Features */
    .features {
      position: relative; z-index: 1;
      max-width: 1200px; margin: 0 auto; padding: 4rem 2rem 6rem;
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;
    }
    .feature-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; padding: 2rem; transition: all 0.3s;
    }
    .feature-card:hover { border-color: ${info.color}40; transform: translateY(-4px); box-shadow: 0 8px 40px ${info.color}10; }
    .feature-icon { font-size: 2rem; margin-bottom: 1rem; }
    .feature-title { font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; }
    .feature-desc { color: var(--text-dim); line-height: 1.6; font-size: 0.9rem; }

    /* Footer */
    footer {
      position: relative; z-index: 1;
      border-top: 1px solid var(--border); padding: 3rem 2rem;
      text-align: center; color: var(--text-dim); font-size: 0.85rem;
    }
    .footer-links { display: flex; gap: 2rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .footer-links a { color: var(--text-dim); text-decoration: none; transition: color 0.2s; }
    .footer-links a:hover { color: var(--text); }

    @media (max-width: 640px) {
      nav { padding: 0.75rem 1rem; }
      .nav-links { display: none; }
      .hero { padding: 5rem 1.5rem 3rem; }
    }
  </style>
</head>
<body>
  <div class="sacred-bg"></div>

  <nav>
    <a class="nav-brand" href="/">
      <span class="nav-icon">${info.icon}</span>
      <span class="nav-name">${info.name}<span class="nav-tm">™</span></span>
    </a>
    <div class="nav-links">
      <a href="https://headyio.com">Developers</a>
      <a href="https://headyapi.com">API</a>
      <a href="https://headysystems.com">Enterprise</a>
      <a href="https://headyme.com" class="nav-cta">Get Started</a>
    </div>
  </nav>

  <main class="hero">
    <div class="hero-badge">
      <span class="hero-badge-dot"></span>
      Heady™ Ecosystem · ${info.geo}
    </div>
    <div class="hero-icon">${info.icon}</div>
    <h1>${info.tagline}</h1>
    <p class="hero-sub">${info.name}™ is part of the Heady™ AI ecosystem — powered by Continuous Semantic Logic, Sacred Geometry, and 60+ proprietary patents.</p>
    <div class="hero-actions">
      <a href="https://headyme.com" class="btn btn-primary">Get Started →</a>
      <a href="https://headyio.com" class="btn btn-ghost">Documentation</a>
    </div>
  </main>

  <section class="features">
    <div class="feature-card">
      <div class="feature-icon">🧠</div>
      <div class="feature-title">AI-First Architecture</div>
      <div class="feature-desc">Built on the Heady™ latent OS with vector-native memory, CSL logic gates, and phi-scaled parameters.</div>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🔐</div>
      <div class="feature-title">Enterprise Security</div>
      <div class="feature-desc">Zero-trust edge gateway, OAuth 2.0, encrypted vector vault, and SOC 2 ready compliance.</div>
    </div>
    <div class="feature-card">
      <div class="feature-icon">⚡</div>
      <div class="feature-title">Edge-First Performance</div>
      <div class="feature-desc">Cloudflare Workers edge routing with sub-50ms latency worldwide. Cloud Run auto-scaling backend.</div>
    </div>
  </section>

  <footer>
    <div class="footer-links">
      <a href="https://headyme.com">HeadyMe™</a>
      <a href="https://headysystems.com">HeadySystems™</a>
      <a href="https://heady-ai.com">HeadyAI™</a>
      <a href="https://headyconnection.org">HeadyConnection™</a>
      <a href="https://headybuddy.org">HeadyBuddy™</a>
      <a href="https://headyio.com">HeadyIO™</a>
    </div>
    <p>© 2026 HeadySystems Inc. All rights reserved. Heady™ is a trademark of HeadySystems Inc.</p>
    <p style="margin-top:0.5rem;">Sacred Geometry: ${info.geo} · 60+ Provisional Patents · Continuous Semantic Logic</p>
  </footer>
</body>
</html>`;
}

function generateToolPage(domain, info) {
    const color = info.color || '#6C5CE7';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name}™ — ${info.tagline}</title>
  <meta name="description" content="${info.name}™ internal tool — ${info.tagline}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0d0d14; color: #e0e0f0; min-height: 100vh; }
    nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; border-bottom: 1px solid #1a1a2e; backdrop-filter: blur(10px); }
    .brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; }
    .brand-icon { font-size: 1.3rem; }
    .status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #888; }
    .dot { width: 8px; height: 8px; background: #2ecc71; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: 0.4; } }
    main { max-width: 900px; margin: 3rem auto; padding: 0 2rem; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-top: 2rem; }
    .card { background: #13131f; border: 1px solid #1e1e30; border-radius: 12px; padding: 1.5rem; transition: all 0.2s; cursor: pointer; }
    .card:hover { border-color: ${color}60; transform: translateY(-2px); }
    .card-icon { font-size: 1.8rem; margin-bottom: 0.75rem; }
    .card-title { font-weight: 600; margin-bottom: 0.25rem; }
    .card-desc { color: #888; font-size: 0.85rem; line-height: 1.5; }
    .login-prompt { margin-top: 3rem; text-align: center; padding: 2rem; background: #13131f; border: 1px solid #1e1e30; border-radius: 12px; }
    .btn { display: inline-block; padding: 0.7rem 1.5rem; background: ${color}; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 1rem; transition: all 0.2s; }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px ${color}40; }
    footer { text-align: center; padding: 2rem; color: #555; font-size: 0.8rem; margin-top: 3rem; border-top: 1px solid #1a1a2e; }
  </style>
</head>
<body>
  <nav>
    <div class="brand"><span class="brand-icon">${info.icon}</span> ${info.name}™</div>
    <div class="status"><span class="dot"></span> Internal Tool</div>
  </nav>
  <main>
    <h1>${info.icon} ${info.tagline}</h1>
    <p class="subtitle">${info.name}™ — Heady™ internal service at ${domain}</p>
    <div class="grid">
      <div class="card"><div class="card-icon">📊</div><div class="card-title">Dashboard</div><div class="card-desc">Real-time metrics, status, and operational overview.</div></div>
      <div class="card"><div class="card-icon">⚙️</div><div class="card-title">Configuration</div><div class="card-desc">Service settings, environment variables, and feature flags.</div></div>
      <div class="card"><div class="card-icon">📋</div><div class="card-title">Logs</div><div class="card-desc">Structured logging, trace viewer, and error tracking.</div></div>
      <div class="card"><div class="card-icon">🔌</div><div class="card-title">API Explorer</div><div class="card-desc">Interactive API documentation and testing playground.</div></div>
    </div>
    <div class="login-prompt">
      <p>🔐 Authentication required to access ${info.name}™ tools</p>
      <a href="https://headyme.com" class="btn">Sign In with Heady™</a>
    </div>
  </main>
  <footer>© 2026 HeadySystems Inc. · ${info.name}™ · Heady™ Internal Service · ${domain}</footer>
</body>
</html>`;
}

function generateReservePage(domain, info) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name} — Heady™ Ecosystem</title>
  <meta http-equiv="refresh" content="5;url=https://headyme.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #e0e0f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; }
    .container { max-width: 500px; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.75rem; }
    p { color: #888; margin-bottom: 1.5rem; line-height: 1.6; }
    a { color: #6C5CE7; text-decoration: none; font-weight: 600; }
    .badge { display: inline-block; background: #13131f; border: 1px solid #1e1e30; padding: 0.4rem 1rem; border-radius: 100px; font-size: 0.8rem; color: #888; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Heady™ Ecosystem</div>
    <h1>${info.name}</h1>
    <p>This domain is part of the Heady™ AI ecosystem by HeadySystems Inc.</p>
    <p>Redirecting to <a href="https://headyme.com">headyme.com</a> in 5 seconds...</p>
    <p style="margin-top:2rem; font-size:0.8rem; color:#555;">© 2026 HeadySystems Inc. · 60+ Patents · Continuous Semantic Logic</p>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// Generate & Deploy
// ═══════════════════════════════════════════════════════════════════════

function generateAll() {
    let generated = 0;
    let skipped = 0;

    for (const [domain, info] of Object.entries(DOMAINS.product)) {
        const dir = path.join(SITES_DIR, info.dir);
        const file = path.join(dir, 'index.html');
        // Only generate if no existing file OR file is small/stale
        if (fs.existsSync(file) && fs.statSync(file).size > 10000) {
            console.log(`  ✓ ${domain} — already has content (${(fs.statSync(file).size / 1024).toFixed(0)}KB), skipping`);
            skipped++;
            continue;
        }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, generateProductPage(domain, info));
        console.log(`  ⚡ ${domain} → ${info.dir}/index.html (product page)`);
        generated++;
    }

    for (const [domain, info] of Object.entries(DOMAINS.tool)) {
        const dir = path.join(SITES_DIR, domain.replace(/\.(com|org)$/, ''));
        const file = path.join(dir, 'index.html');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, generateToolPage(domain, info));
        console.log(`  🔧 ${domain} → ${path.basename(dir)}/index.html (tool UI)`);
        generated++;
    }

    for (const [domain, info] of Object.entries(DOMAINS.reserve)) {
        const dir = path.join(SITES_DIR, domain.replace(/\.(com|org)$/, ''));
        const file = path.join(dir, 'index.html');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, generateReservePage(domain, info));
        console.log(`  📌 ${domain} → ${path.basename(dir)}/index.html (reserve/redirect)`);
        generated++;
    }

    console.log(`\n✅ Generated: ${generated} | Skipped (existing): ${skipped} | Total dirs: ${generated + skipped}`);
}

console.log('═══════════════════════════════════════════════');
console.log('  Heady™ Site Generator — ALL 59 DOMAINS');
console.log('═══════════════════════════════════════════════\n');
generateAll();

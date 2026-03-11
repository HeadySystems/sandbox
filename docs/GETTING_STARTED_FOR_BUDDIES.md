# 🧠 Heady™ — Getting Started

> Welcome to the Heady™ Intelligence Layer. This guide gets you up and running in under 5 minutes.

---

## What You Get

| Surface | What It Does |
|---------|-------------|
| **VS Code Extension** | AI chat, explain, refactor, battle-validate, swarm, and audit — right in your editor |
| **Chrome Extension** | AI assistant in your browser sidebar |
| **SDK** (`@heady-ai/sdk`) | Programmatic access to Heady from your own code |
| **MCP Server** (`@heady-ai/mcp-server`) | Model Context Protocol integration for tool-based AI |

---

## 1. Install the VS Code Extension

### Option A: VSIX file (fastest)

```bash
code --install-extension heady-ai-1.1.0.vsix
```

### Option B: VS Code Marketplace

Search **"Heady™ AI"** in the Extensions panel (`Ctrl+Shift+X`).

### Configure

1. Open VS Code Settings (`Ctrl+,`)
2. Search for **"Heady"**
3. Set your **API Key** (provided to you)
4. Optionally change the **Model** (default: `heady-flash`)

### Use It

- `Ctrl+Shift+H` — Open Heady Chat
- Right-click any code → **Heady: Explain / Refactor / Battle-Validate**
- Command Palette (`Ctrl+Shift+P`) → type "Heady" for all commands

---

## 2. Install the Chrome Extension

### Option A: Load unpacked (for testing)

1. Unzip `heady-chrome-extension.zip`
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the unzipped folder

### Option B: Chrome Web Store

Search **"Heady™ AI"** (when published).

---

## 3. Use the SDK (Optional)

```bash
npm install @heady-ai/sdk
```

```javascript
const { HeadyClient } = require('@heady-ai/sdk');

const heady = new HeadyClient('hdy_YOUR_API_KEY');

// Call any Heady™ AI tool
const result = await heady.callTool('memory.store', {
  userId: 'buddy-1',
  x: 0.5, y: 0.3, z: 0.8,
  embedding: [0.1, 0.2, ...],
  metadata: { topic: 'project-alpha' }
});

// Health check
const health = await heady.healthCheck();
console.log(health); // { status: 'healthy', version: '3.2.0', ... }
```

---

## 4. Use the MCP Server (Optional)

```bash
npm install @heady-ai/mcp-server
```

```javascript
const { MCPServer } = require('@heady-ai/mcp-server');

const server = new MCPServer();

// Handle incoming MCP requests
const response = await server.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
});
// Returns: { tools: [{ name: 'memory.store', ... }, ...] }
```

---

## Available Models

| Model | Speed | Description | Access |
|-------|-------|-------------|--------|
| `heady-flash` | ⚡ ~1s | Top 3 fastest nodes | Free |
| `heady-edge` | 🌐 <200ms | Edge inference | Free |
| `heady-buddy` | 🤝 ~3s | Memory-aware companion | Pro |
| `heady-reason` | 🧠 ~10s | Deep analysis, extended thinking | Premium |
| `heady-battle-v1` | 🏆 ~30s | Full 20-node arena competition | Premium |

---

## API Key

Your API key looks like: `hdy_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

- Keep it secret — don't commit to git
- Each key has a rate limit of 1000 requests/hour
- If your key stops working, ask for a new one

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension doesn't respond | Check API key in VS Code settings |
| "Connection refused" | Backend may be updating — try again in 60s |
| Slow responses | Switch model to `heady-flash` or `heady-edge` |
| Chrome extension blank | Reload the extension from `chrome://extensions` |

---

## Support

- 📧 <eric@headyconnection.org>
- 🌐 <https://headysystems.com>
- 🐛 <https://github.com/HeadyMe/heady-production/issues>

---

*© 2026 Heady™Systems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces*

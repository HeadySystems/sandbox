# MCP (Model Context Protocol) Integration

## Overview

MCP is a standardized protocol for AI model context sharing. Heady uses MCP to communicate between HeadyBuddy, HeadyOrchestrator, and external AI services.

## Architecture

```
HeadyBuddy → MCP Client → MCP Server → LLM Provider
                ↓
          Vector Memory
          (context cache)
```

## MCP Message Schema

```javascript
const MCPMessage = {
  version: '1.0',
  timestamp: Date.now(),
  messageId: 'unique-id',
  context: {
    conversationId: 'conv-123',
    userId: 'user-456',
    sessionId: 'session-789'
  },
  payload: {
    type: 'query' | 'response' | 'memory_update',
    content: {},
    metadata: {}
  }
};
```

## MCP Server Implementation

```javascript
const express = require('express');
const { VectorMemory } = require('../memory/vector-memory');

class HeadyMCPServer {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.memory = new VectorMemory({ dimensions: 384 });
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.json());

    // MCP query endpoint
    this.app.post('/mcp/query', async (req, res) => {
      try {
        const message = req.body;
        const response = await this.handleQuery(message);
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // MCP context retrieval
    this.app.post('/mcp/context', async (req, res) => {
      try {
        const { conversationId, limit = 10 } = req.body;
        const context = await this.retrieveContext(conversationId, limit);
        res.json({ context });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // MCP memory storage
    this.app.post('/mcp/memory', async (req, res) => {
      try {
        const { conversationId, content, metadata } = req.body;
        await this.storeMemory(conversationId, content, metadata);
        res.json({ status: 'stored' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  async handleQuery(message) {
    const { context, payload } = message;

    // Retrieve relevant memories
    const memories = await this.memory.searchText(
      payload.content.query,
      5,
      0.618  // CSL threshold
    );

    // Build response with context
    return {
      version: '1.0',
      timestamp: Date.now(),
      messageId: `response-${Date.now()}`,
      context: context,
      payload: {
        type: 'response',
        content: {
          memories,
          relevance: memories.length > 0 ? memories[0].score : 0
        }
      }
    };
  }

  async retrieveContext(conversationId, limit) {
    const results = await this.memory.search(
      null,  // No query vector
      limit,
      { conversationId }  // Filter by conversation
    );
    return results;
  }

  async storeMemory(conversationId, content, metadata = {}) {
    const id = `${conversationId}-${Date.now()}`;
    await this.memory.storeText(id, content, {
      ...metadata,
      conversationId,
      timestamp: Date.now()
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HeadyMCP Server listening on port ${this.port}`);
    });
  }
}

// Usage
const server = new HeadyMCPServer({ port: 8080 });
server.start();
```

## MCP Client Implementation

```javascript
const axios = require('axios');

class HeadyMCPClient {
  constructor(serverUrl = 'http://localhost:8080') {
    this.serverUrl = serverUrl;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async query(conversationId, queryText) {
    const message = {
      version: '1.0',
      timestamp: Date.now(),
      messageId: `msg-${Date.now()}`,
      context: {
        conversationId,
        sessionId: this.sessionId
      },
      payload: {
        type: 'query',
        content: { query: queryText }
      }
    };

    const response = await axios.post(`${this.serverUrl}/mcp/query`, message);
    return response.data;
  }

  async getContext(conversationId, limit = 10) {
    const response = await axios.post(`${this.serverUrl}/mcp/context`, {
      conversationId,
      limit
    });
    return response.data.context;
  }

  async storeMemory(conversationId, content, metadata = {}) {
    await axios.post(`${this.serverUrl}/mcp/memory`, {
      conversationId,
      content,
      metadata
    });
  }
}

// Usage in HeadyBuddy
const mcp = new HeadyMCPClient('http://headymcp.com:8080');

async function handleUserMessage(conversationId, message) {
  // Retrieve context
  const context = await mcp.getContext(conversationId, 5);

  // Query with context
  const response = await mcp.query(conversationId, message);

  // Store interaction
  await mcp.storeMemory(conversationId, message, {
    role: 'user',
    timestamp: Date.now()
  });

  return response;
}
```

## Integration with VSA

```javascript
class VSAMCPServer extends HeadyMCPServer {
  constructor(options) {
    super(options);
    this.vsa = new VSAEngine(10000);
    this.atoms = new Map();
  }

  async handleQuery(message) {
    const { payload } = message;

    // Encode query with VSA
    const queryVector = this.encodeQuery(payload.content.query);

    // Search with VSA similarity
    const results = await this.memory.search(queryVector, 5);

    return {
      version: '1.0',
      timestamp: Date.now(),
      messageId: `response-${Date.now()}`,
      context: message.context,
      payload: {
        type: 'response',
        content: {
          results,
          encoding: 'vsa-10000'
        }
      }
    };
  }

  encodeQuery(text) {
    // Tokenize and encode with VSA
    const words = text.toLowerCase().split(/\s+/);
    const vectors = words.map(word => {
      if (!this.atoms.has(word)) {
        this.atoms.set(word, randomHypervector(10000));
      }
      return this.atoms.get(word);
    });

    return this.vsa.bundle(...vectors);
  }
}
```

## WebSocket Alternative for Real-Time

```javascript
const WebSocket = require('ws');

class HeadyMCPWebSocket {
  constructor(port = 8080) {
    this.wss = new WebSocket.Server({ port });
    this.clients = new Map();

    this.wss.on('connection', (ws) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          const response = await this.handleMessage(message);
          ws.send(JSON.stringify(response));
        } catch (err) {
          ws.send(JSON.stringify({ error: err.message }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });
    });
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async handleMessage(message) {
    // Handle MCP messages over WebSocket
    return { status: 'processed', messageId: message.messageId };
  }

  broadcast(message) {
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}
```

## Security & Authentication

```javascript
const jwt = require('jsonwebtoken');

function authenticateMCP(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.MCP_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Apply to routes
app.post('/mcp/query', authenticateMCP, async (req, res) => {
  // Handle authenticated query
});
```

## References

- Model Context Protocol spec (if available)
- HeadyMCP.com deployment details
- Your spec: HeadyMCP integration section

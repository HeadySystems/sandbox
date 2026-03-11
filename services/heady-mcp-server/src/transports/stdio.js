/**
 * Heady™ MCP Stdio Transport
 * Standard input/output transport for Claude Desktop, Claude Code, Cursor
 */
'use strict';

const readline = require('readline');

class StdioTransport {
  constructor(protocol) {
    this.protocol = protocol;
    this.buffer = '';
  }

  start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      if (!line.trim()) return;

      try {
        const request = JSON.parse(line);
        const response = await this.protocol.handleRequest(request);
        if (response) {
          this._send(response);
        }
      } catch (err) {
        this._send({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Parse error: ${err.message}` },
        });
      }
    });

    rl.on('close', () => {
      process.exit(0);
    });

    process.stdin.on('error', () => process.exit(0));
    process.stdout.on('error', () => process.exit(0));
  }

  _send(obj) {
    const json = JSON.stringify(obj);
    process.stdout.write(json + '\n');
  }
}

module.exports = { StdioTransport };

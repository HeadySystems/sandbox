# MIDI to UDP Conversion Pattern

## Overview

Convert MIDI controller messages to UDP packets for Heady™OS real-time data transfer.

## Architecture

```
MIDI Controller → MIDI Parser → UDP Encoder → Network → HeadyOS Receiver
```

## Node.js Implementation

### Dependencies

```json
{
  "dependencies": {
    "midi": "^2.1.0",
    "dgram": "^1.0.1"
  }
}
```

### MIDI to UDP Bridge

```javascript
const midi = require('midi');
const dgram = require('dgram');

class MIDItoUDP {
  constructor(options = {}) {
    this.udpHost = options.udpHost || 'localhost';
    this.udpPort = options.udpPort || 7000;
    this.midiPort = options.midiPort || 0;

    this.input = new midi.Input();
    this.socket = dgram.createSocket('udp4');

    this.setupMIDI();
  }

  setupMIDI() {
    // List available MIDI inputs
    const portCount = this.input.getPortCount();
    console.log(`Found ${portCount} MIDI input ports:`);
    for (let i = 0; i < portCount; i++) {
      console.log(`  ${i}: ${this.input.getPortName(i)}`);
    }

    // Open specified port
    if (portCount > 0) {
      this.input.openPort(this.midiPort);
      console.log(`Opened MIDI port: ${this.input.getPortName(this.midiPort)}`);
    } else {
      console.warn('No MIDI ports available');
      return;
    }

    // Listen for MIDI messages
    this.input.on('message', (deltaTime, message) => {
      this.handleMIDI(message);
    });
  }

  handleMIDI(message) {
    const [status, data1, data2] = message;

    // Parse MIDI message type
    const messageType = status & 0xF0;
    const channel = status & 0x0F;

    const packet = {
      type: this.getMIDIType(messageType),
      channel,
      data1,
      data2,
      timestamp: Date.now()
    };

    // Send as UDP packet
    this.sendUDP(packet);
  }

  getMIDIType(messageType) {
    const types = {
      0x80: 'NOTE_OFF',
      0x90: 'NOTE_ON',
      0xA0: 'POLYPHONIC_AFTERTOUCH',
      0xB0: 'CONTROL_CHANGE',
      0xC0: 'PROGRAM_CHANGE',
      0xD0: 'CHANNEL_AFTERTOUCH',
      0xE0: 'PITCH_BEND'
    };
    return types[messageType] || 'UNKNOWN';
  }

  sendUDP(packet) {
    const message = Buffer.from(JSON.stringify(packet));
    this.socket.send(message, this.udpPort, this.udpHost, (err) => {
      if (err) console.error('UDP send error:', err);
    });
  }

  close() {
    this.input.closePort();
    this.socket.close();
  }
}

// Usage
const bridge = new MIDItoUDP({
  udpHost: 'headyos.local',
  udpPort: 7000,
  midiPort: 0
});
```

### Heady™OS UDP Receiver

```javascript
const dgram = require('dgram');

class HeadyOSMIDIReceiver {
  constructor(port = 7000) {
    this.port = port;
    this.socket = dgram.createSocket('udp4');
    this.handlers = new Map();

    this.setupSocket();
  }

  setupSocket() {
    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet = JSON.parse(msg.toString());
        this.dispatch(packet);
      } catch (err) {
        console.error('Invalid UDP packet:', err);
      }
    });

    this.socket.on('listening', () => {
      const address = this.socket.address();
      console.log(`HeadyOS MIDI Receiver listening on ${address.address}:${address.port}`);
    });

    this.socket.bind(this.port);
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  dispatch(packet) {
    const handlers = this.handlers.get(packet.type);
    if (handlers) {
      handlers.forEach(handler => handler(packet));
    }

    // Also dispatch to 'all' handlers
    const allHandlers = this.handlers.get('ALL');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(packet));
    }
  }

  close() {
    this.socket.close();
  }
}

// Usage in HeadyOS
const receiver = new HeadyOSMIDIReceiver(7000);

receiver.on('NOTE_ON', (packet) => {
  console.log(`Note ON: ${packet.data1}, velocity: ${packet.data2}`);
  // Trigger HeadyOS action
});

receiver.on('CONTROL_CHANGE', (packet) => {
  console.log(`CC ${packet.data1}: ${packet.data2}`);
  // Update HeadyOS parameter
});
```

## Integration with Heady™ Vector Memory

Map MIDI gestures to memory queries:

```javascript
class MIDIMemoryController {
  constructor(vectorMemory, receiver) {
    this.memory = vectorMemory;

    // Map MIDI CC to memory queries
    receiver.on('CONTROL_CHANGE', async (packet) => {
      if (packet.data1 === 1) {  // Mod wheel
        const query = this.modulationToQuery(packet.data2);
        const results = await this.memory.searchText(query, 5);
        console.log('Memory recall:', results);
      }
    });

    // Map notes to memory storage
    receiver.on('NOTE_ON', async (packet) => {
      const text = `MIDI note ${packet.data1} velocity ${packet.data2}`;
      await this.memory.storeText(`midi-${Date.now()}`, text, {
        source: 'midi',
        note: packet.data1,
        velocity: packet.data2
      });
    });
  }

  modulationToQuery(ccValue) {
    // Map 0-127 to predefined queries
    const queries = [
      'recent memories',
      'important tasks',
      'user preferences',
      'system status'
    ];
    const index = Math.floor((ccValue / 127) * (queries.length - 1));
    return queries[index];
  }
}
```

## Performance Considerations

- UDP is connectionless (fire-and-forget)
- No guaranteed delivery (use TCP if reliability needed)
- Low latency (~1ms local network)
- Suitable for real-time control data

## Security

```javascript
// Add authentication token to packets
function sendSecureUDP(packet, secret) {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(packet));
  packet.signature = hmac.digest('hex');
  return packet;
}

function verifyUDP(packet, secret) {
  const crypto = require('crypto');
  const signature = packet.signature;
  delete packet.signature;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(packet));
  const expected = hmac.digest('hex');

  return signature === expected;
}
```

## References

- NVIDIA Korgi (MIDI to UDP): https://github.com/NVIDIA/Korgi
- Node.js MIDI: https://www.npmjs.com/package/midi
- Node.js dgram: https://nodejs.org/api/dgram.html

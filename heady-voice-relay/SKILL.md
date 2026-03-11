---
name: heady-voice-relay
description: Use when working with voice relay systems, speech-to-text, text-to-speech, audio processing, or HeadyBuddy conversational voice interfaces in the Heady™ ecosystem. Keywords include voice, speech, TTS, STT, audio, voice relay, conversational, HeadyBuddy voice, and speech processing.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Voice Relay

## When to Use This Skill

Use this skill when the user needs to:
- Configure voice relay for Heady™Buddy
- Implement speech-to-text (STT) or text-to-speech (TTS)
- Set up real-time audio streaming between devices
- Optimize voice latency for conversational AI
- Integrate with voice hardware or assistants

## Module Map

| Module | Path | Role |
|---|---|---|
| voice-relay | src/intelligence/voice-relay.js | Central voice I/O routing |
| voice-relay (bootstrap) | src/bootstrap/voice-relay.js | Voice service initialization |

## Instructions

### Voice Relay Architecture
1. Audio input captured via Web Audio API or native mic.
2. STT processing: stream audio chunks to provider (Whisper, Deepgram, Google).
3. AI processing: text sent to HeadyBuddy agent for response.
4. TTS synthesis: response text converted to speech (ElevenLabs, Google, Gemini).
5. Audio output streamed back to user device.

### Latency Optimization
- Target end-to-end latency: < 500ms (Fibonacci * 10 base).
- Audio chunking: 89ms frames for STT streaming.
- Parallel processing: start TTS before full response is generated.
- Edge routing: use nearest Cloudflare POP for STT/TTS.
- Voice Activity Detection (VAD): phi-threshold silence detection.

### Configuration
```javascript
const voiceConfig = {
  stt: {
    provider: 'whisper', // or 'deepgram', 'google'
    model: 'whisper-large-v3',
    language: 'auto',
    chunkSize: 89, // ms, Fibonacci
  },
  tts: {
    provider: 'elevenlabs', // or 'google', 'gemini'
    voice: 'HeadyBuddy',
    speed: 1.0,
    stability: 0.618, // phi ratio
  },
  relay: {
    maxLatency: 500,
    bufferSize: 233, // ms, Fibonacci
    vadThreshold: 0.382, // phi ratio
  }
};
```

### Cross-Device Voice
- WebRTC for peer-to-peer audio between devices.
- Fallback: server-relayed audio via voice-relay.js.
- Device bridge (buddy-device-bridge.js) manages connections.
- Wake word detection runs on-device for privacy.

## Output Format

- Voice Configuration
- Latency Metrics
- Provider Status
- Audio Pipeline Topology
- Device Connection Map

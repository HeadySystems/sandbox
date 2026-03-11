---
name: heady-midi-creative
description: Use when working with MIDI music integration, event bus systems, creative content generation, edge-side image diffusion, or artistic AI capabilities in the Heady™ ecosystem. Keywords include MIDI, music, creative, diffusion, generative art, event bus, audio, Ableton, HeadyBuddy creative, and artistic AI.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ MIDI & Creative Engine

## When to Use This Skill

Use this skill when the user needs to:
- Integrate MIDI hardware/software with Heady™
- Work with the MIDI event bus for music processing
- Generate creative content (images, music, text) via the creative-bee
- Configure edge-side diffusion for AI art generation
- Connect Heady with Ableton Live or other DAWs

## Module Map

| Module | Path | Role |
|---|---|---|
| midi-bee | src/bees/midi-bee.js | MIDI event processing bee |
| midi-event-bus | src/engines/midi-event-bus.js | Central MIDI message routing |
| network-midi | src/midi/network-midi.js | Network MIDI (RTP-MIDI) transport |
| creative-bee | src/bees/creative-bee.js | Creative content generation |
| edge-diffusion | src/creative/edge-diffusion.js | Edge-side image generation |
| HeadyBuddyScript | ableton-remote-script/ | Ableton Live remote script |

## Instructions

### MIDI Integration
1. MIDI messages route through the midi-event-bus.js central hub.
2. Network MIDI uses RTP-MIDI protocol for low-latency transport.
3. The Ableton remote script (HeadyBuddyScript.py) enables DAW control.
4. MIDI CC mappings use phi-scaled parameter ranges.
5. Note velocity curves follow golden ratio scaling.

### Creative Content Pipeline
1. Creative-bee handles text-to-image, text-to-music, and style transfer.
2. Edge-diffusion.js runs lightweight inference on Cloudflare Workers AI.
3. CSL gates control creative parameters (temperature, guidance, steps).
4. All creative outputs are embedded into vector memory for recall.

### Event Bus Architecture
```
MIDI Input → midi-event-bus → [midi-bee, creative-bee, telemetry-bee]
                ↓
        network-midi (RTP-MIDI) → Remote DAW/Devices
                ↓
        HeadyBuddyScript → Ableton Live
```

### Phi-Scaled MIDI Parameters
- Tempo range: 89-144 BPM (Fibonacci)
- Velocity curves: 0.382, 0.618, 1.0 (phi ratios)
- CC smoothing: phi-weighted moving average
- Latency budget: 8ms target (Fibonacci)

## Output Format

- MIDI Configuration
- Event Bus Topology
- Creative Pipeline Status
- Generated Content References
- Performance Metrics

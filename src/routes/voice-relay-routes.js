/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Voice Relay API Routes
 * REST API for Heady™Buddy voice relay services (TTS/STT).
 * WebSocket relay is handled separately in bootstrap/voice-relay.js.
 * Skill: heady-voice-relay
 */

'use strict';

const { Router } = require('express');

const router = Router();

// ─── GET /status ──────────────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
    try {
        let relayStatus = { active: false, protocol: 'websocket', restFallback: true };
        try {
            const relay = require('../bootstrap/voice-relay');
            if (typeof relay.getStatus === 'function') relayStatus = relay.getStatus();
            else relayStatus.active = true;
        } catch { /* voice relay not booted */ }
        res.json({ ok: true, data: relayStatus });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /tts ────────────────────────────────────────────────────────────────
router.post('/tts', async (req, res) => {
    try {
        const { text, voice = 'default', format = 'mp3' } = req.body;
        if (!text) return res.status(400).json({ ok: false, error: 'text (string) required' });

        // Attempt to use edge TTS or provider
        let audioUrl = null;
        try {
            const ttsProvider = require('../services/edge-diffusion');
            if (typeof ttsProvider.textToSpeech === 'function') {
                audioUrl = await ttsProvider.textToSpeech(text, { voice, format });
            }
        } catch { /* TTS provider not available */ }

        if (!audioUrl) {
            return res.status(503).json({
                ok: false,
                error: 'TTS service not available. Configure edge-diffusion or external TTS provider.',
                requested: { text: text.slice(0, 100), voice, format },
            });
        }
        res.json({ ok: true, data: { audioUrl, voice, format, charCount: text.length } });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /stt ────────────────────────────────────────────────────────────────
router.post('/stt', async (req, res) => {
    try {
        // STT expects audio data or reference
        const { audioUrl, language = 'en' } = req.body;
        if (!audioUrl) return res.status(400).json({ ok: false, error: 'audioUrl (string) required' });

        let transcription = null;
        try {
            const sttProvider = require('../services/edge-diffusion');
            if (typeof sttProvider.speechToText === 'function') {
                transcription = await sttProvider.speechToText(audioUrl, { language });
            }
        } catch { /* STT provider not available */ }

        if (!transcription) {
            return res.status(503).json({
                ok: false,
                error: 'STT service not available. Configure edge-diffusion or external STT provider.',
            });
        }
        res.json({ ok: true, data: transcription });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

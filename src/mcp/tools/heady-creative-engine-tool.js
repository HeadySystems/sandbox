'use strict';

/**
 * heady-creative-engine-tool.js — MCP Tool Handler
 *
 * Routes to creative-domain prompts: brand voice, naming framework,
 * narrative design, visual direction, pitch deck, campaign strategy,
 * UX copy, storyboard.
 *
 * © 2026 Heady™Systems Inc.
 */

const crypto = require('crypto');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// ─── Creative Prompt Templates ───────────────────────────────────────────────

const CREATIVE_PROMPTS = {
    'brand-voice': {
        id: 'creative-001', name: 'Brand Voice Copy',
        description: 'Generate brand-aligned copy in a specified voice',
        template: (vars) => `You are a brand copywriter crafting content for "${vars.brand || 'Brand'}".
Brand voice: ${vars.voice || 'professional, innovative, approachable'}
Target audience: ${vars.audience || 'tech-savvy professionals'}
Content type: ${vars.content_type || 'landing page copy'}
Key messages: ${vars.key_messages || 'innovation, reliability, elegance'}

Generate compelling copy that embodies the brand voice and resonates with the target audience.`,
    },
    'naming': {
        id: 'creative-002', name: 'Naming Framework',
        description: 'Generate naming options for products, features, or companies',
        template: (vars) => `Generate naming options for: ${vars.subject || 'a new product'}
Industry: ${vars.industry || 'technology'}
Values: ${vars.values || 'innovation, simplicity, trust'}
Style: ${vars.style || 'modern, memorable, distinctive'}
Constraints: ${vars.constraints || 'available as .com domain'}

Provide 10 name candidates with rationale for each, organized by naming strategy (descriptive, invented, metaphorical, acronym).`,
    },
    'narrative': {
        id: 'creative-003', name: 'Narrative Design',
        description: 'Design narrative arcs for products or experiences',
        template: (vars) => `Design a narrative arc for: ${vars.product || 'product experience'}
User journey stage: ${vars.stage || 'onboarding to mastery'}
Emotional arc: ${vars.emotions || 'curiosity → discovery → delight → confidence'}
Brand personality: ${vars.personality || 'innovative guide'}

Create a narrative framework with key story beats, micro-copy moments, and emotional transitions.`,
    },
    'visual-direction': {
        id: 'creative-004', name: 'Visual Direction Brief',
        description: 'Generate visual direction briefs for design teams',
        template: (vars) => `Create a visual direction brief for: ${vars.project || 'UI redesign'}
Brand: ${vars.brand || 'modern tech platform'}
Mood: ${vars.mood || 'clean, dynamic, premium'}
References: ${vars.references || 'none specified'}

Provide: color palette (with hex codes), typography recommendations, spacing philosophy (phi-scaled), imagery direction, iconography style, and motion principles.`,
    },
    'pitch-deck': {
        id: 'creative-005', name: 'Pitch Deck Narrative',
        description: 'Structure a compelling pitch deck narrative',
        template: (vars) => `Structure a pitch deck narrative for: ${vars.company || 'AI startup'}
Stage: ${vars.stage || 'Series A'}
Core value proposition: ${vars.value_prop || 'describe your unique value'}
Target investors: ${vars.investors || 'venture capital'}

Structure into slides: Hook → Problem → Solution → Market → Traction → Business Model → Team → Ask → Vision.`,
    },
    'campaign': {
        id: 'creative-006', name: 'Campaign Strategy',
        description: 'Design multi-channel marketing campaigns',
        template: (vars) => `Design a campaign strategy for: ${vars.product || 'product launch'}
Channels: ${vars.channels || 'social, email, content, paid'}
Budget tier: ${vars.budget || 'medium'}
Timeline: ${vars.timeline || '8 weeks'}
KPIs: ${vars.kpis || 'awareness, signups, activation'}

Provide campaign theme, channel-specific tactics, content calendar outline, and success metrics.`,
    },
    'ux-copy': {
        id: 'creative-007', name: 'UX Microcopy',
        description: 'Generate UX microcopy for interfaces',
        template: (vars) => `Generate UX microcopy for: ${vars.component || 'onboarding flow'}
Product: ${vars.product || 'SaaS platform'}
Tone: ${vars.tone || 'helpful, concise, encouraging'}
Context: ${vars.context || 'first-time user experience'}

Provide: headlines, body text, button labels, empty states, error messages, success confirmations, and tooltips.`,
    },
    'storyboard': {
        id: 'creative-008', name: 'Storyboard Script',
        description: 'Write storyboard scripts for product demos or ads',
        template: (vars) => `Write a storyboard script for: ${vars.type || 'product demo video'}
Duration: ${vars.duration || '60 seconds'}
Audience: ${vars.audience || 'potential customers'}
Key feature: ${vars.feature || 'describe the key feature'}

Structure as scenes with: visual description, voiceover text, on-screen text, and transition notes.`,
    },
};

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handler(params) {
    const { action = 'list', prompt_type, variables = {} } = params;

    switch (action) {
        case 'list': {
            const prompts = Object.entries(CREATIVE_PROMPTS).map(([key, p]) => ({
                key, id: p.id, name: p.name, description: p.description,
            }));
            return { ok: true, action: 'list', total: prompts.length, prompts };
        }

        case 'generate': {
            if (!prompt_type || !CREATIVE_PROMPTS[prompt_type]) {
                return {
                    ok: false,
                    error: `Unknown prompt_type: ${prompt_type}. Available: ${Object.keys(CREATIVE_PROMPTS).join(', ')}`,
                };
            }

            const prompt = CREATIVE_PROMPTS[prompt_type];
            const interpolated = prompt.template(variables);
            const inputHash = crypto.createHash('sha256')
                .update(prompt_type + JSON.stringify(variables))
                .digest('hex').slice(0, 16);

            return {
                ok: true,
                action: 'generate',
                prompt_type,
                prompt_id: prompt.id,
                prompt_name: prompt.name,
                input_hash: inputHash,
                interpolated,
                llm_params: { temperature: 0.7, top_p: 0.95, max_tokens: 2048 }, // Creative uses higher temp
                timestamp: new Date().toISOString(),
            };
        }

        default:
            return { ok: false, error: `Unknown action: ${action}. Use: list, generate` };
    }
}

module.exports = {
    name: 'heady_creative_engine',
    description: 'Creative domain engine — brand voice, naming, narrative, visual, pitch, campaign, UX copy, storyboard',
    category: 'creative',
    handler,
    CREATIVE_PROMPTS,
    inputSchema: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['list', 'generate'] },
            prompt_type: { type: 'string', enum: Object.keys(CREATIVE_PROMPTS), description: 'Creative prompt type' },
            variables: { type: 'object', description: 'Template variables (brand, audience, etc.)' },
        },
        required: ['action'],
    },
};

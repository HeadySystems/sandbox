'use strict';

/**
 * heady-trading-intelligence-tool.js — MCP Tool Handler
 * Trading domain prompts: signal, risk, backtest, portfolio, sentiment,
 * options, macro, execution. All constants from φ.
 * © 2026 Heady™Systems Inc.
 */

const crypto = require('crypto');
const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;

const TRADING_TYPES = [
    'signal-analysis', 'risk-model', 'backtest', 'portfolio',
    'sentiment', 'options', 'macro', 'execution',
];

const TEMPLATES = {
    'signal-analysis': (v) => `Analyze signal: ${v.asset || 'asset'}, ${v.timeframe || '1D'}, indicators: ${v.indicators || 'RSI,MACD'}. Confidence threshold: >${PSI.toFixed(3)}.`,
    'risk-model': (v) => `Risk model: ${v.portfolio || 'portfolio'}, tolerance: ${v.risk_tolerance || 'moderate'}. Phi tiers: conservative <${PSI_SQ.toFixed(3)}, moderate ${PSI_SQ.toFixed(3)}-${PSI.toFixed(3)}, aggressive >${PSI.toFixed(3)}.`,
    'backtest': (v) => `Backtest: ${v.strategy || 'strategy'}, ${v.asset_class || 'equities'}, ${v.period || '2020-2025'}. Fibonacci entry/exit, ${v.mc_iterations || 7} MC iterations.`,
    'portfolio': (v) => `Portfolio: ${v.universe || 'US equities'}, target ${v.target_return || '10%'}. Phi-weighted: primary ${PSI.toFixed(3)}, secondary ${PSI_SQ.toFixed(3)}.`,
    'sentiment': (v) => `Sentiment: ${v.asset || 'market'} from ${v.sources || 'news,social'}. Phi-scaled -1 to +1, gate threshold |s|>${PSI_SQ.toFixed(3)}.`,
    'options': (v) => `Options: ${v.underlying || 'SPY'}, outlook ${v.outlook || 'neutral'}, ${v.expiry || '30-45 DTE'}. Delta target ${PSI.toFixed(3)}.`,
    'macro': (v) => `Macro: ${v.economy || 'US'}, focus ${v.focus || 'rates,inflation'}. Fibonacci time cycles: 1,2,3,5,8,13,21 months.`,
    'execution': (v) => `Execution algo: ${v.order_type || 'block'} for ${v.asset || 'equity'}, urgency ${v.urgency || 'moderate'}. Fibonacci time-slicing.`,
};

async function handler(params) {
    const { action = 'list', prompt_type, variables = {} } = params;
    if (action === 'list') {
        return {
            ok: true, domain: 'trading', total: 8, prompts: TRADING_TYPES.map((k, i) => ({
                key: k, id: `trading-${String(i + 1).padStart(3, '0')}`, name: k.replace(/-/g, ' '),
            }))
        };
    }
    if (action === 'analyze') {
        if (!prompt_type || !TEMPLATES[prompt_type]) return { ok: false, error: `Unknown: ${prompt_type}` };
        const interpolated = TEMPLATES[prompt_type](variables);
        const hash = crypto.createHash('sha256').update(prompt_type + JSON.stringify(variables)).digest('hex').slice(0, 16);
        return {
            ok: true, action: 'analyze', prompt_type, input_hash: hash, interpolated,
            phi: { PHI, PSI, PSI_SQ }, llm_params: { temperature: 0, seed: 42 }, ts: new Date().toISOString()
        };
    }
    return { ok: false, error: `Unknown action: ${action}` };
}

module.exports = {
    name: 'heady_trading_intelligence',
    description: 'Trading intelligence — signal, risk, backtest, portfolio, sentiment, options, macro, execution',
    category: 'intelligence', handler, TEMPLATES,
    inputSchema: {
        type: 'object', properties: {
            action: { type: 'string', enum: ['list', 'analyze'] },
            prompt_type: { type: 'string', enum: TRADING_TYPES },
            variables: { type: 'object' },
        }, required: ['action']
    },
};

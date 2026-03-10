// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: apps/hive/src/socratic_protocol.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
﻿'use strict';

/**
 * Socratic Protocol for Heady Systems
 * 
 * Intelligent task analysis and MCP tool allocation engine.
 * Implements Golden Ratio weighted resource distribution.
 * 
 * @copyright HeadySystems Inc. 2026
 * @patent-pending Dynamic MCP orchestration protocol
 */

const GOLDEN_RATIO = 1.61803398875;

// Complexity keyword categories with phi-weighted importance
const COMPLEXITY_KEYWORDS = {
    critical: ['database', 'migration', 'core', 'security', 'auth', 'api', 'infrastructure', 'deploy', 'production'],
    elevated: ['refactor', 'integration', 'workflow', 'pipeline', 'orchestration', 'sync'],
    standard: ['update', 'add', 'create', 'modify', 'implement']
};

const LOW_IMPACT_KEYWORDS = ['docs', 'readme', 'comment', 'typo', 'style', 'format', 'lint', 'cleanup'];

// Expanded MCP Server Capabilities Mapping with Golden Ratio weights
const MCP_MAPPINGS = {
    // Database & Storage (weight: 0.382)
    'database': ['postgresql', 'prisma-mcp-server'],
    'sql': ['postgresql'],
    'migration': ['prisma-mcp-server', 'postgresql'],
    'schema': ['prisma-mcp-server', 'postgresql'],
    'query': ['postgresql'],
    
    // Search & Research (weight: 0.236)
    'search': ['perplexity-ask', 'exa'],
    'research': ['perplexity-ask', 'deepwiki'],
    'find': ['perplexity-ask', 'exa', 'grep'],
    'lookup': ['perplexity-ask', 'deepwiki'],
    'investigate': ['perplexity-ask', 'sequential-thinking'],
    
    // Documentation (weight: 0.146)
    'docs': ['deepwiki', 'cloudflare-docs'],
    'documentation': ['deepwiki', 'cloudflare-docs'],
    'wiki': ['deepwiki'],
    'cloudflare': ['cloudflare-docs'],
    'worker': ['cloudflare-docs'],
    
    // Deployment & CI/CD (weight: 0.090)
    'deploy': ['terraform', 'github-mcp-server'],
    'terraform': ['terraform'],
    'infrastructure': ['terraform', 'github-mcp-server'],
    'cicd': ['github-mcp-server'],
    'workflow': ['github-mcp-server'],
    'action': ['github-mcp-server'],
    'pipeline': ['github-mcp-server', 'terraform'],
    
    // Testing & UI (weight: 0.056)
    'test': ['mcp-playwright', 'puppeteer'],
    'e2e': ['mcp-playwright', 'puppeteer'],
    'browser': ['mcp-playwright', 'puppeteer'],
    'ui': ['mcp-playwright', 'puppeteer', 'figma-remote-mcp-server'],
    'screenshot': ['mcp-playwright', 'puppeteer'],
    'figma': ['figma-remote-mcp-server'],
    'design': ['figma-remote-mcp-server'],
    
    // Security & Compliance (weight: 0.034)
    'security': ['snyk'],
    'audit': ['snyk'],
    'vulnerability': ['snyk'],
    'compliance': ['snyk', 'sequential-thinking'],
    'scan': ['snyk'],
    
    // AI & ML Services (weight: 0.021)
    'huggingface': ['huggingface'],
    'model': ['huggingface', 'google_mcp'],
    'inference': ['huggingface'],
    'ai': ['huggingface', 'google_mcp', 'perplexity-ask'],
    'gemini': ['google_mcp'],
    'llm': ['huggingface', 'google_mcp'],
    'embedding': ['huggingface'],
    'transformer': ['huggingface'],
    
    // Version Control (weight: 0.013)
    'git': ['github-mcp-server'],
    'github': ['github-mcp-server'],
    'repo': ['github-mcp-server'],
    'commit': ['github-mcp-server'],
    'branch': ['github-mcp-server'],
    'pr': ['github-mcp-server'],
    'issue': ['github-mcp-server'],
    'pull': ['github-mcp-server'],
    
    // Planning & Reasoning (weight: 0.008)
    'plan': ['sequential-thinking'],
    'complex': ['sequential-thinking'],
    'analyze': ['sequential-thinking', 'perplexity-ask'],
    'strategy': ['sequential-thinking'],
    'architect': ['sequential-thinking'],
    'design': ['sequential-thinking', 'figma-remote-mcp-server'],
    
    // Memory & Context (weight: 0.005)
    'remember': ['memory'],
    'context': ['memory'],
    'history': ['memory'],
    'recall': ['memory'],
    
    // Maps & Location (weight: 0.003)
    'map': ['google-maps'],
    'location': ['google-maps'],
    'geocode': ['google-maps'],
    'directions': ['google-maps'],
    
    // Payments (weight: 0.002)
    'payment': ['stripe'],
    'stripe': ['stripe'],
    'billing': ['stripe'],
    'subscription': ['stripe']
};

// Tool priority order based on Golden Ratio distribution
const TOOL_PRIORITY = [
    'sequential-thinking',
    'filesystem',
    'github-mcp-server',
    'memory',
    'perplexity-ask',
    'postgresql',
    'snyk',
    'cloudflare-docs',
    'terraform',
    'mcp-playwright',
    'puppeteer',
    'huggingface',
    'google_mcp',
    'figma-remote-mcp-server',
    'stripe',
    'google-maps'
];

module.exports = {
    GOLDEN_RATIO,
    TOOL_PRIORITY,
    MCP_MAPPINGS,
    
    /**
     * Evaluate task instruction and determine optimal MCP tool allocation
     * @param {string} instruction - The task instruction to analyze
     * @param {Object} context - Additional context (files_changed, type, etc.)
     * @returns {Object} Evaluation result with complexity, tools, and reasoning
     */
    evaluate: function(instruction, context) {
        let complexity = 'LOW';
        let complexityScore = 0;
        let reasoning = [];
        let recommended_tools = ['filesystem']; // Base requirement
        let securityAuditRequired = false;

        const lowerInstruction = (instruction || '').toLowerCase();

        // Heuristic 1: Multi-tier Keyword Analysis for Complexity
        const criticalMatches = COMPLEXITY_KEYWORDS.critical.filter(kw => lowerInstruction.includes(kw));
        const elevatedMatches = COMPLEXITY_KEYWORDS.elevated.filter(kw => lowerInstruction.includes(kw));
        const standardMatches = COMPLEXITY_KEYWORDS.standard.filter(kw => lowerInstruction.includes(kw));

        if (criticalMatches.length > 0) {
            complexity = 'HIGH';
            complexityScore += criticalMatches.length * 3;
            reasoning.push(`Detected critical system keywords: [${criticalMatches.join(', ')}].`);
            
            // Security audit trigger
            if (criticalMatches.some(kw => ['security', 'auth', 'deploy', 'production'].includes(kw))) {
                securityAuditRequired = true;
            }
        }

        if (elevatedMatches.length > 0) {
            if (complexity !== 'HIGH') complexity = 'MEDIUM';
            complexityScore += elevatedMatches.length * 2;
            reasoning.push(`Detected elevated keywords: [${elevatedMatches.join(', ')}].`);
        }

        if (standardMatches.length > 0) {
            complexityScore += standardMatches.length;
        }

        // Heuristic 2: Comprehensive MCP Tool Selection
        const toolsAdded = new Set();
        Object.keys(MCP_MAPPINGS).forEach(key => {
            if (lowerInstruction.includes(key)) {
                MCP_MAPPINGS[key].forEach(tool => {
                    if (!recommended_tools.includes(tool)) {
                        recommended_tools.push(tool);
                        toolsAdded.add(key);
                    }
                });
            }
        });

        if (toolsAdded.size > 0) {
            reasoning.push(`MCP tools allocated for: [${Array.from(toolsAdded).join(', ')}].`);
        }

        // Heuristic 3: Instruction Length with phi-based thresholds
        const phiThreshold1 = Math.round(100 * GOLDEN_RATIO); // ~162 chars
        const phiThreshold2 = Math.round(200 * GOLDEN_RATIO); // ~324 chars

        if (instruction && instruction.length > phiThreshold2) {
            complexity = 'HIGH';
            complexityScore += 5;
            reasoning.push(`Instruction length (${instruction.length}) exceeds phi-threshold-2 (${phiThreshold2}).`);
            if (!recommended_tools.includes('sequential-thinking')) {
                recommended_tools.push('sequential-thinking');
            }
        } else if (instruction && instruction.length > phiThreshold1) {
            if (complexity === 'LOW') complexity = 'MEDIUM';
            complexityScore += 2;
            reasoning.push(`Instruction length suggests moderate scope.`);
        }

        // Heuristic 4: Contextual hints
        if (context) {
            if (context.files_changed && context.files_changed.length > 5) {
                complexity = 'HIGH';
                complexityScore += context.files_changed.length;
                reasoning.push(`High volume of file changes (${context.files_changed.length}).`);
            }
            if (context.type === 'FULL_REBUILD') {
                complexity = 'HIGH';
                complexityScore += 10;
                reasoning.push('Explicit full rebuild requested.');
            }
            if (context.all_mcp_mode) {
                reasoning.push('All MCP services mode enabled.');
            }
        }

        // Heuristic 5: Low impact detection (can downgrade)
        const lowImpactMatches = LOW_IMPACT_KEYWORDS.filter(kw => lowerInstruction.includes(kw));
        if (lowImpactMatches.length > 0 && complexity === 'LOW' && complexityScore < 3) {
            reasoning.push('Routine documentation or style change.');
        }

        // Heuristic 6: Security audit requirement detection
        if (securityAuditRequired && !recommended_tools.includes('snyk')) {
            recommended_tools.push('snyk');
            reasoning.push('Security audit required - added snyk.');
        }

        // Default reasoning
        if (reasoning.length === 0) {
            reasoning.push('Standard build parameters observed.');
        }

        // Sort tools by priority
        recommended_tools.sort((a, b) => {
            const aIdx = TOOL_PRIORITY.indexOf(a);
            const bIdx = TOOL_PRIORITY.indexOf(b);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });

        // Calculate golden ratio optimization score
        const optimizationScore = Math.round((complexityScore / GOLDEN_RATIO) * 100) / 100;

        return {
            complexity,
            complexity_score: complexityScore,
            optimization_score: optimizationScore,
            reasoning: reasoning.join(' '),
            recommended_tools,
            security_audit_required: securityAuditRequired,
            phi_aligned: complexityScore % 2 === 0 || complexityScore % 3 === 0,
            timestamp: new Date().toISOString()
        };
    },

    /**
     * Get all available MCP mappings
     * @returns {Object} The MCP_MAPPINGS object
     */
    getMappings: function() {
        return MCP_MAPPINGS;
    },

    /**
     * Get tool priority list
     * @returns {Array} Ordered list of tools by priority
     */
    getToolPriority: function() {
        return TOOL_PRIORITY;
    },

    /**
     * Calculate optimal resource allocation based on Golden Ratio
     * @param {number} totalResources - Total resources available
     * @param {Array} tools - Tools to allocate resources to
     * @returns {Object} Resource allocation map
     */
    allocateResources: function(totalResources, tools) {
        const allocation = {};
        let remaining = totalResources;
        
        tools.forEach((tool, index) => {
            // Each successive tool gets phi-ratio less resources
            const share = remaining / GOLDEN_RATIO;
            allocation[tool] = Math.round(share * 100) / 100;
            remaining -= share;
        });

        return allocation;
    }
};

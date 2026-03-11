/**
 * @heady-ai/content-engine — Content Loader
 * 
 * Loads and merges the 3-layer content architecture:
 *   Layer 1: global/       — brand-wide content
 *   Layer 2: products/     — product-specific content
 *   Layer 3: domains/{d}/  — domain-specific content
 * 
 * Domain content overrides product content overrides global content.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ContentConfig {
    contentRoot: string;
}

const DEFAULT_CONFIG: ContentConfig = {
    contentRoot: join(process.cwd(), 'content'),
};

/**
 * Load a JSON file or return null if not found.
 */
function loadJson<T = any>(filePath: string): T | null {
    if (!existsSync(filePath)) return null;
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
    } catch {
        console.warn(`[content-engine] Failed to parse: ${filePath}`);
        return null;
    }
}

/**
 * Load a markdown file or return null if not found.
 */
function loadMarkdown(filePath: string): string | null {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf-8');
}

/**
 * Load the global brand content.
 */
export function loadGlobalContent(config = DEFAULT_CONFIG) {
    const globalDir = join(config.contentRoot, 'global');
    return {
        brandCore: loadMarkdown(join(globalDir, 'brand-core.md')),
        brandVoice: loadMarkdown(join(globalDir, 'brand-voice.md')),
        messagingPillars: loadJson(join(globalDir, 'messaging-pillars.json')),
        audiences: loadJson(join(globalDir, 'audiences.json')),
        universalCta: loadJson(join(globalDir, 'universal-cta.json')),
        legal: {
            privacy: loadMarkdown(join(globalDir, 'legal', 'privacy-summary.md')),
            responsibleAi: loadMarkdown(join(globalDir, 'legal', 'responsible-ai.md')),
        },
    };
}

/**
 * Load product-level content.
 */
export function loadProductContent(productId: string, config = DEFAULT_CONFIG) {
    const productFile = join(config.contentRoot, 'products', `${productId}.json`);
    return loadJson(productFile);
}

/**
 * Load domain-specific content.
 */
export function loadDomainContent(domain: string, config = DEFAULT_CONFIG) {
    const domainDir = join(config.contentRoot, 'domains', domain);

    if (!existsSync(domainDir)) {
        console.warn(`[content-engine] Domain directory not found: ${domainDir}`);
        return null;
    }

    return {
        site: loadJson(join(domainDir, 'site.json')),
        hero: loadJson(join(domainDir, 'hero.json')),
        features: loadJson(join(domainDir, 'features.json')),
        meta: loadJson(join(domainDir, 'meta.json')),
        personas: loadJson(join(domainDir, 'personas.json')),
        endpoints: loadJson(join(domainDir, 'endpoints.json')),
    };
}

/**
 * Load the full merged content for a domain.
 * Merges: global → product(s) → domain-specific.
 */
export function loadFullContent(domain: string, productRefs: string[] = [], config = DEFAULT_CONFIG) {
    const global = loadGlobalContent(config);
    const products = productRefs.map(ref => ({
        id: ref,
        data: loadProductContent(ref, config),
    })).filter(p => p.data !== null);
    const domainContent = loadDomainContent(domain, config);

    return {
        global,
        products,
        domain: domainContent,
        merged: {
            ...domainContent,
            globalBrand: global,
        },
    };
}

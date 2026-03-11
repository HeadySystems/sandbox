#!/usr/bin/env node

/**
 * validate-content.mjs — Heady Content Kit Validator
 * 
 * Ensures every domain in configs/domains.json has the required
 * content files, valid JSON, and SEO constraints.
 * 
 * Usage: node scripts/validate-content.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(process.cwd());
const REGISTRY_PATH = join(ROOT, 'configs', 'domains.json');
const CONTENT_DIR = join(ROOT, 'content', 'domains');

const REQUIRED_FILES = ['site.json', 'hero.json', 'meta.json'];
const SEO_TITLE_MAX = 70;
const SEO_DESC_MAX = 160;

let errors = 0;
let warnings = 0;

function error(msg) { errors++; console.error(`  ❌ ${msg}`); }
function warn(msg) { warnings++; console.warn(`  ⚠️  ${msg}`); }
function ok(msg) { console.log(`  ✅ ${msg}`); }

// Load registry
if (!existsSync(REGISTRY_PATH)) {
    console.error(`FATAL: Registry not found at ${REGISTRY_PATH}`);
    process.exit(1);
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
const domains = registry.domains || [];

console.log(`\n🔍 Heady Content Validator`);
console.log(`   Registry: ${REGISTRY_PATH}`);
console.log(`   Content:  ${CONTENT_DIR}`);
console.log(`   Domains:  ${domains.length}\n`);

for (const entry of domains) {
    const domain = entry.domain;
    const domainDir = join(CONTENT_DIR, domain);

    console.log(`\n📂 ${domain} (${entry.status})`);

    // Check domain dir exists
    if (!existsSync(domainDir)) {
        error(`Content directory missing: ${domainDir}`);
        continue;
    }

    // Check required files
    for (const file of REQUIRED_FILES) {
        const filePath = join(domainDir, file);
        if (!existsSync(filePath)) {
            error(`Missing required file: ${file}`);
            continue;
        }

        // Validate JSON
        try {
            const content = JSON.parse(readFileSync(filePath, 'utf-8'));
            ok(`${file} — valid JSON`);

            // SEO checks for meta.json
            if (file === 'meta.json') {
                if (content.title && content.title.length > SEO_TITLE_MAX) {
                    warn(`SEO title too long (${content.title.length}/${SEO_TITLE_MAX}): "${content.title}"`);
                }
                if (content.description && content.description.length > SEO_DESC_MAX) {
                    warn(`SEO description too long (${content.description.length}/${SEO_DESC_MAX}): "${content.description.substring(0, 50)}..."`);
                }
                if (!content.title) error('meta.json missing title');
                if (!content.description) error('meta.json missing description');
            }

            // Hero checks
            if (file === 'hero.json') {
                if (!content.headline) error('hero.json missing headline');
                if (!content.primaryCta) warn('hero.json missing primaryCta');
            }

            // Site checks
            if (file === 'site.json') {
                if (!content.siteId) error('site.json missing siteId');
                if (!content.brand) error('site.json missing brand');
                if (!content.navigation || content.navigation.length === 0) warn('site.json has empty navigation');
            }

        } catch (e) {
            error(`${file} — invalid JSON: ${e.message}`);
        }
    }
}

// Check global content
console.log(`\n📂 Global Content`);
const globalFiles = ['brand-core.md', 'brand-voice.md', 'messaging-pillars.json', 'audiences.json', 'universal-cta.json'];
for (const file of globalFiles) {
    const filePath = join(ROOT, 'content', 'global', file);
    if (existsSync(filePath)) {
        ok(file);
    } else {
        error(`Missing global file: ${file}`);
    }
}

// Summary
console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 Results: ${errors} errors, ${warnings} warnings`);
console.log(`   Domains checked: ${domains.length}`);
if (errors === 0) {
    console.log(`\n🎉 All content validation passed!\n`);
    process.exit(0);
} else {
    console.log(`\n💥 Validation failed with ${errors} error(s)\n`);
    process.exit(1);
}

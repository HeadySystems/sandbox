#!/usr/bin/env node

/**
 * scaffold-domain.mjs — Heady Domain Scaffolder
 * 
 * Creates a new domain content folder from the _template.
 * 
 * Usage: node scripts/scaffold-domain.mjs <domain> <siteId> <brand>
 * Example: node scripts/scaffold-domain.mjs headynew.com headynew HeadyNew
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(process.cwd());
const TEMPLATE_DIR = join(ROOT, 'content', 'domains', '_template');
const CONTENT_DIR = join(ROOT, 'content', 'domains');

const [, , domain, siteId, brand] = process.argv;

if (!domain || !siteId || !brand) {
    console.error('Usage: node scripts/scaffold-domain.mjs <domain> <siteId> <brand>');
    console.error('Example: node scripts/scaffold-domain.mjs headynew.com headynew HeadyNew');
    process.exit(1);
}

const targetDir = join(CONTENT_DIR, domain);

if (existsSync(targetDir)) {
    console.error(`❌ Directory already exists: ${targetDir}`);
    process.exit(1);
}

if (!existsSync(TEMPLATE_DIR)) {
    console.error(`❌ Template directory not found: ${TEMPLATE_DIR}`);
    process.exit(1);
}

// Create target directory
mkdirSync(targetDir, { recursive: true });

// Copy and fill template files
const templateFiles = readdirSync(TEMPLATE_DIR);
const replacements = {
    '{{DOMAIN}}': domain,
    '{{SITE_ID}}': siteId,
    '{{BRAND}}': brand,
    '{{TAGLINE}}': `Welcome to ${brand}`,
    '{{PURPOSE}}': `${brand} domain — purpose pending`,
    '{{EYEBROW}}': brand,
    '{{HEADLINE}}': `Welcome to ${brand}`,
    '{{SUBHEADLINE}}': `${brand} — part of the Heady ecosystem.`,
    '{{CTA_LABEL}}': 'Get Started',
    '{{CTA_HREF}}': '/get-started',
    '{{CTA2_LABEL}}': 'Learn More',
    '{{CTA2_HREF}}': '/about',
    '{{DESCRIPTION}}': `${brand} is part of the Heady intelligent ecosystem.`,
};

for (const file of templateFiles) {
    let content = readFileSync(join(TEMPLATE_DIR, file), 'utf-8');
    for (const [placeholder, value] of Object.entries(replacements)) {
        content = content.replaceAll(placeholder, value);
    }
    writeFileSync(join(targetDir, file), content);
    console.log(`  ✅ Created ${file}`);
}

console.log(`\n🎉 Scaffolded domain: ${domain} at ${targetDir}`);
console.log(`   Next: Customize site.json, hero.json, and meta.json with real content.`);

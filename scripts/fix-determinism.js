#!/usr/bin/env node
/**
 * Fix Determinism Issues
 * Automatically corrects count mismatches in documentation
 */

const fs = require('fs');
const path = require('path');

function fixServiceCount() {
  const servicesDir = path.join(process.cwd(), 'services');

  if (!fs.existsSync(servicesDir)) {
    console.log('⚠️  Services directory not found');
    return 0;
  }

  const services = fs.readdirSync(servicesDir)
    .filter(dir => {
      const stat = fs.statSync(path.join(servicesDir, dir));
      return stat.isDirectory() && dir.startsWith('heady-');
    });

  console.log(`✅ Found ${services.length} service directories`);
  return services.length;
}

function fixPromptCount() {
  const promptLibPath = path.join(process.cwd(), 'configs/prompts/heady-prompt-library.json');

  if (!fs.existsSync(promptLibPath)) {
    console.log('⚠️  Prompt library not found');
    return { total: 0, categories: 0 };
  }

  const promptLib = JSON.parse(fs.readFileSync(promptLibPath, 'utf8'));
  const categories = Object.keys(promptLib);
  const total = categories.reduce((sum, cat) => sum + promptLib[cat].length, 0);

  console.log(`✅ Found ${total} prompts across ${categories.length} categories`);
  return { total, categories: categories.length };
}

function updateContextFile(serviceCount, promptData) {
  const contextPath = path.join(process.cwd(), 'docs/heady-context.md');

  if (!fs.existsSync(contextPath)) {
    console.log('⚠️  Context file not found');
    return;
  }

  let content = fs.readFileSync(contextPath, 'utf8');

  // Fix service count
  content = content.replace(
    /KEY SERVICES \(\d+ (?:Core )?Directories\)/,
    `KEY SERVICES (${serviceCount} Core Directories - AUTO-GENERATED)`
  );

  // Fix prompt count
  content = content.replace(
    /\d+ master prompts across \d+ categories/,
    `${promptData.total} master prompts across ${promptData.categories} categories (AUTO-GENERATED)`
  );

  fs.writeFileSync(contextPath, content, 'utf8');
  console.log('✅ Context file updated with correct counts');
}

console.log('🔧 Fixing Determinism Issues\n');
const serviceCount = fixServiceCount();
const promptData = fixPromptCount();
updateContextFile(serviceCount, promptData);
console.log('\n✅ Determinism fixes complete!');

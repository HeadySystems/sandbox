#!/usr/bin/env node
/**
 * Heady™ Endpoint Validation Script
 * Verifies all documented endpoints are reachable and properly configured
 * Usage: node scripts/validate-endpoints.js
 */

const https = require('https');
const http = require('http');

const ENDPOINTS = {
  production: [
    { url: 'https://headyme.com', name: 'HeadyMe Admin', required: true },
    { url: 'https://headysystems.com', name: 'HeadySystems', required: true },
    { url: 'https://headyconnection.org', name: 'HeadyConnection', required: true },
    { url: 'https://headyio.com', name: 'HeadyIO Docs', required: true },
    { url: 'https://headymcp.com', name: 'HeadyMCP', required: true },
    { url: 'https://headybuddy.org', name: 'HeadyBuddy', required: true },
    { url: 'https://headybot.com', name: 'HeadyBot', required: true },
  ],
  backend: [
    { url: 'https://heady-manager-609590223909.us-central1.run.app/health', name: 'Heady Manager', required: false },
    { url: 'https://heady.headyme.com', name: 'Edge Proxy', required: false },
  ],
  deprecated: [
    { url: 'https://headyme-heady-ai.hf.space', name: 'HF Heady AI', required: false },
    { url: 'https://headyme-heady-demo.hf.space', name: 'HF Heady Demo', required: false },
  ]
};

function checkEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(endpoint.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'HeadyEndpointValidator/1.0' }
    }, (res) => {
      resolve({
        ...endpoint,
        status: res.statusCode,
        success: res.statusCode >= 200 && res.statusCode < 400,
        headers: res.headers,
      });
    });

    req.on('error', (err) => {
      resolve({
        ...endpoint,
        status: 0,
        success: false,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ...endpoint,
        status: 0,
        success: false,
        error: 'Timeout',
      });
    });
  });
}

async function validateAll() {
  console.log('🔍 Heady Endpoint Validation\n');
  console.log('═'.repeat(70));

  let totalChecks = 0;
  let passedChecks = 0;
  let criticalFails = 0;

  for (const [category, endpoints] of Object.entries(ENDPOINTS)) {
    console.log(`\n📂 ${category.toUpperCase()}\n`);

    for (const endpoint of endpoints) {
      totalChecks++;
      const result = await checkEndpoint(endpoint);

      const icon = result.success ? '✅' : '❌';
      const statusText = result.status || 'UNREACHABLE';

      console.log(`${icon} ${result.name}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Status: ${statusText}`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.success) {
        passedChecks++;
        if (result.headers['x-heady-version']) {
          console.log(`   Version: ${result.headers['x-heady-version']}`);
        }
      } else if (result.required) {
        criticalFails++;
        console.log(`   ⚠️  CRITICAL: Required endpoint is down!`);
      }

      console.log('');
    }
  }

  console.log('═'.repeat(70));
  console.log(`\n📊 SUMMARY\n`);
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed: ${passedChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);
  console.log(`Failed: ${totalChecks - passedChecks}`);
  console.log(`Critical Failures: ${criticalFails}`);

  if (criticalFails > 0) {
    console.log('\n❌ VALIDATION FAILED: Critical endpoints are down!');
    process.exit(1);
  } else if (passedChecks === totalChecks) {
    console.log('\n✅ ALL ENDPOINTS VERIFIED');
    process.exit(0);
  } else {
    console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS');
    process.exit(0);
  }
}

validateAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

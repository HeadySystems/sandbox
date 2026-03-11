#!/usr/bin/env node
/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 * 
 * ═══ Heady™ Patent Test Runner ═══
 * Runs all test suites for patent implementations.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testsDir = path.join(__dirname, 'tests');
const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.startsWith('test-') && f.endsWith('.js'))
    .sort();

console.log('═══════════════════════════════════════════════════════');
console.log('  Heady™ Patent Implementation Test Suite');
console.log('  © 2026 Heady™Systems Inc.');
console.log('═══════════════════════════════════════════════════════');
console.log(`\n  Found ${testFiles.length} test suites\n`);

let totalPassed = 0;
let totalFailed = 0;
let failedSuites = [];

for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    const label = file.replace('test-', '').replace('.js', '');
    
    try {
        const output = execSync(`node "${filePath}"`, {
            timeout: 30000,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        
        // Parse pass/fail from output
        const passMatch = output.match(/(\d+)\s*(?:passed|✓|PASS)/i);
        const failMatch = output.match(/(\d+)\s*(?:failed|✗|FAIL)/i);
        const passed = passMatch ? parseInt(passMatch[1]) : 0;
        const failed = failMatch ? parseInt(failMatch[1]) : 0;
        
        totalPassed += passed;
        totalFailed += failed;
        
        const status = failed === 0 ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${status}  ${label.padEnd(30)} ${passed} passed, ${failed} failed`);
        
        if (failed > 0) failedSuites.push(file);
    } catch (err) {
        totalFailed++;
        failedSuites.push(file);
        console.log(`  ✗ FAIL  ${label.padEnd(30)} ERROR: ${err.message.split('\n')[0]}`);
    }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
console.log('═══════════════════════════════════════════════════════');

if (failedSuites.length > 0) {
    console.log(`\n  Failed suites: ${failedSuites.join(', ')}`);
    process.exit(1);
} else {
    console.log('\n  All tests passed. ✓');
    process.exit(0);
}

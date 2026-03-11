import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('auto-context bridge avoids browser storage references', () => {
  const text = readFileSync('/home/user/workspace/heady-system-build/packages/auto-context/auto-context-bridge.js', 'utf8');
  assert.equal(text.includes('sessionStorage'), false);
  assert.equal(text.includes('localStorage'), false);
});

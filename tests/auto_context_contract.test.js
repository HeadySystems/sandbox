import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('/home/user/workspace/heady-system-build/services/specialized/heady-auto-context/index.js', 'utf8');

test('autocontext exposes required routes', () => {
  for (const required of ['/context/enrich', '/context/index-batch', '/context/remove', '/context/query']) {
    assert.ok(text.includes(required), `missing ${required}`);
  }
});

test('autocontext keeps index state', () => {
  assert.ok(text.includes('sourceIndex = new Map()'));
  assert.ok(text.includes('buildEnrichmentResponse'));
});

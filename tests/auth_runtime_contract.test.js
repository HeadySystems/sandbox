import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('/home/user/workspace/heady-system-build/services/user-facing/heady-auth/index.js', 'utf8');

test('auth exposes oauth launch and callback routes', () => {
  for (const required of ['/oauth/google', '/oauth/github', '/oauth/google/callback', '/oauth/github/callback']) {
    assert.ok(text.includes(required), `missing ${required}`);
  }
});

test('auth uses secure cookie attributes', () => {
  assert.ok(text.includes('HttpOnly; Secure; SameSite=Strict'));
  assert.ok(text.includes('redirect-not-allowlisted'));
  assert.ok(text.includes('invalid-oauth-state'));
});

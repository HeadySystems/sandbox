import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('root docs and knowledge base exist', () => {
  const required = [
    '/home/user/workspace/heady-system-build/CHANGES.md',
    '/home/user/workspace/heady-system-build/GAPS_FOUND.md',
    '/home/user/workspace/heady-system-build/IMPROVEMENTS.md',
    '/home/user/workspace/heady-system-build/docs/architecture/system-topology.md',
    '/home/user/workspace/heady-system-build/docs/runbooks/local-validation.md',
    '/home/user/workspace/heady-system-build/docs/security/zero-trust-posture.md',
    '/home/user/workspace/heady-system-build/docs/onboarding/developer-onboarding.md',
    '/home/user/workspace/heady-system-build/docs/operations/error-catalog.md',
  ];
  for (const file of required) assert.ok(existsSync(file), `missing ${file}`);
});

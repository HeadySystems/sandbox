import { spawnSync } from 'node:child_process';

const steps = [
  ['node', ['./scripts/validate-no-localhost.mjs']],
  ['node', ['./scripts/generate-service-manifests.mjs']],
  ['node', ['./scripts/smoke-test.mjs']],
];

for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

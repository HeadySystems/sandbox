from pathlib import Path
import sys

root = Path('/home/user/workspace/heady-system-build')

required_files = [
    root / 'CHANGES.md',
    root / 'GAPS_FOUND.md',
    root / 'IMPROVEMENTS.md',
    root / 'docs/architecture/system-topology.md',
    root / 'docs/runbooks/local-validation.md',
    root / 'docs/security/zero-trust-posture.md',
    root / 'docs/onboarding/developer-onboarding.md',
    root / 'docs/operations/error-catalog.md',
]

failures = []
for file_path in required_files:
    if not file_path.exists():
        failures.append(f'missing: {file_path}')

service_packages = list(root.glob('services/**/package.json'))
if len(service_packages) < 50:
    failures.append(f'expected at least 50 service package.json files, found {len(service_packages)}')

auth_text = (root / 'services/user-facing/heady-auth/index.js').read_text(encoding='utf-8')
for required in ['/oauth/google', '/oauth/github', '/oauth/google/callback', '/oauth/github/callback']:
    if required not in auth_text:
        failures.append(f'auth route missing: {required}')

auto_text = (root / 'services/specialized/heady-auto-context/index.js').read_text(encoding='utf-8')
for required in ['/context/enrich', '/context/index-batch', '/context/remove']:
    if required not in auto_text:
        failures.append(f'autocontext route missing: {required}')

bridge_text = (root / 'packages/auto-context/auto-context-bridge.js').read_text(encoding='utf-8')
if 'sessionStorage' in bridge_text or 'localStorage' in bridge_text:
    failures.append('browser storage reference remains in auto-context bridge')

if failures:
    print('VALIDATION FAILED')
    for failure in failures:
        print('-', failure)
    sys.exit(1)

print('VALIDATION PASSED')
print(f'services={len(service_packages)}')

# Heady™ Full Rebuild Workflow

This workflow packages the current repository into a distributable ZIP and runs a naming-consistency audit.

## Quick Commands

```bash
# Full rebuild (audit + bundle)
npm run rebuild:all

# Individual steps
npm run rebuild:audit           # CJS naming convention scan
npm run rebuild:audit:strict    # ESM strict mode (fails on violations)
npm run rebuild:bundle          # Naming report + zip bundle
npm run rebuild:zip             # Zip bundle only

# Autonomous orchestrator (timing + summary)
node scripts/autonomous/rebuild-orchestrator.js
node scripts/autonomous/rebuild-orchestrator.js --strict
```

## Outputs

| Command | Output |
|---------|--------|
| `rebuild:bundle` | `dist/naming-audit-report.json` + `dist/heady-pre-production-sacred-genesis.zip` |
| `rebuild:zip` | `dist/heady-pre-production-sacred-genesis.zip` |
| `rebuild:audit` | stdout violations report (exit 1 if violations found) |
| `rebuild:audit:strict` | stdout violations (ESM scanner, exit 1 if violations) |

## Script Inventory

| Script | Language | Purpose |
|--------|----------|---------|
| `scripts/make_zip.py` | Python | Clean project zip with exclusions, symlink handling, argparse |
| `scripts/rebuild_sacred_genesis.py` | Python | Naming audit + zip bundle (orchestrates make_zip.py) |
| `scripts/audit-naming-conventions.js` | CJS | Source directory naming scanner |
| `scripts/naming-convention-audit.mjs` | ESM | Kebab-case enforcement with strict mode |
| `scripts/autonomous/rebuild-orchestrator.js` | CJS | Sequences all steps with timing |

## Notes

- The naming report is diagnostic — fix violations systematically before release.
- The bundle can be shipped directly or attached to release artifacts.
- Old `scripts/rebuild/` files are deprecation shims that delegate to the consolidated scripts above.

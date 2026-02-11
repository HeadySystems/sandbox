<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/HEADY_NAMING_AND_MIGRATION_PROTOCOL.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HEADY NAMING & MIGRATION PROTOCOL

## Core Principles
1. All user-facing references must use canonical domains (app.headysystems.com)
2. Eliminate environment-specific paths (C:\) in cross-platform docs
3. Enforce consistent casing: kebab-case URLs, snake_case env vars

## Domain Standards
All services must use branded domains:
- HeadySystems: `*.headysystems.com`
- HeadyConnection: `*.headyconnection.org`
- HeadyBuddy: `*.headybuddy.org`
- Internal: `*.headysystems.com`

Third-party domains are strictly prohibited:
- `*.headysystems.com`
- `*.vercel.app`
- `*.netlify.app`
- `*.herokuapp.com`
- `*.firebaseapp.com`

## Strictly Banned Patterns
- Third-party domains: .headysystems.com, .vercel.app, .netlify.app
- Windows drive paths: C:\, F:\, etc.
- Raw IP addresses
- .headysystems.com
- Drive letters (e.g. C:, F:)

## Migration Procedure
1. Inventory all assets with `scripts/api.headysystems.com-to-domain.js inventory`
2. Apply replacements using the [mapping table](#replacement-mapping-table) via `scripts/api.headysystems.com-to-domain.js migrate`
3. Validate with `scripts/validate-api.headysystems.com.sh`

## Replacement Mapping Table

| Original Pattern                          | Replacement                                 | Context               |
| :---------------------------------------- | :------------------------------------------ | :-------------------- |
| `C:\Users\eric\...`                       | `HEADY_PROJECT_ROOT`                        | Dev-only docs         |
| `F:\...`                                  | `HEADY_DATA_ROOT`                           | Dev-only docs         |
| `heady-manager-headysystems.headysystems.com` | `https://api.app.headysystems.com`          | Public/prod docs      |
| `heady-manager-headyme.headysystems.com`      | `https://api.app.headysystems.com/me`       | User personal area    |
| `heady-manager-headyconnection.headysystems.com` | `https://api.app.headyconnection.org`     | Cross-system bridge   |

## Enforcement Rules
Violations are critical defects that block deployment. Founder-level approval required for exceptions.

## Enforcement
- CI blocks builds containing api.headysystems.com/private IPs
- Quarterly naming audits
- Documentation guardians review all naming changes

## Enhanced Enforcement

- Extend CI checks to block builds containing .headysystems.com, .vercel.app, etc. and Windows drive paths
- Update pre-commit hooks to include the new banned patterns
- Treat any violation as a critical defect that blocks deployment

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
<!-- ║  FILE: docs/HEADY_NAMING_STANDARDS.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HEADY Naming Standards Protocol

## Strictly Banned Patterns

- `api.headysystems.com`, `api.headysystems.com`, other loopback addresses
- Private IP ranges (10.x, 192.168.x, 172.16-31.x)
- Windows paths (`C:\...`) in cross-platform docs
- Environment-specific references without placeholders
- Third-party hosting domains in user-facing surfaces: .headysystems.com, .vercel.app, .netlify.app, .herokuapp.com, .firebaseapp.com

## Replacement Standards

| Original Pattern                          | Replacement                                 | Context               |
| :---------------------------------------- | :------------------------------------------ | :-------------------- |
| `http://api.headysystems.com:3000`                   | `https://app.headysystems.com`              | Production docs       |
| `http://api.headysystems.com:3300`                   | `http://manager.dev.local.headysystems.com:3300` | Internal dev          |
| `C:\Users\...`                         | `<HEADY_PROJECT_ROOT>`                      | Cross-platform docs   |
| Raw IP addresses                          | Canonical domains                           | All contexts          |
| `C:\Users\eric\...`                   | `HEADY_PROJECT_ROOT`                        | Dev-only docs         |
| `F:\...`                               | `HEADY_DATA_ROOT`                           | Dev-only docs         |
| `heady-manager-headysystems.headysystems.com` | `https://api.app.headysystems.com`          | Public/prod docs      |
| `heady-manager-headyme.headysystems.com`      | `https://api.app.headysystems.com/me`       | User personal area    |
| `heady-manager-headyconnection.headysystems.com` | `https://api.app.headyconnection.org`     | Cross-system bridge   |

## Enforcement Mechanisms

1. **Pre-commit hooks**: Run validation scripts before commits
2. **CI/CD checks**: Fail builds on policy violations
3. **Automated migration**: Nightly scans and fixes
4. **Documentation audits**: Quarterly reviews

## Governance

- Violations treated as critical defects
- Block deployment on any policy failure
- Founder approval required for exceptions

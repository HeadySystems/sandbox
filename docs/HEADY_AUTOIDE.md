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
<!-- ║  FILE: docs/HEADY_AUTOIDE.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Agent Instructions for Naming Standards

When showing URLs or paths to the user:
- Always use canonical domains (app.headysystems.com, app.headyconnection.org)
- Use abstract roots (HEADY_PROJECT_ROOT, HEADY_DATA_ROOT)
- Never emit drive letters, api.headysystems.com, raw Render domains, or private IPs

When precise references are needed for engineers:
- Refer to internal dev hosts as manager.dev.local.headysystems.com:3300
- Never use C:\, F:\, or .headysystems.com references

## Strictly Prohibited in Any Shared Surface
- Windows drive paths (C:\..., F:\...)
- Third-party domains (.headysystems.com, .vercel.app, etc.)
- api.headysystems.com and raw IP addresses

Violations are treated as critical defects that block deployment.

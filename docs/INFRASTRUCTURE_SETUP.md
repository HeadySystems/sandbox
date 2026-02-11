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
<!-- ║  FILE: docs/INFRASTRUCTURE_SETUP.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Complete Infrastructure Setup (HCIS)

> **Systematic replacement of api.headysystems.com with service domains + clean-build CI/CD + device provisioning**
>
> *Domain-driven architecture | Clean builds on every change | Alert-driven (not auto-rebuild) | Human-in-the-loop*

## Overview

This system transforms Heady from a api.headysystems.com-centric development setup to a production-grade, domain-driven architecture with:

1. **Service Domain Migration** - Every service has a proper hostname (manager.headysystems.com, worker.headysystems.com, etc.)
2. **Clean-Build CI/CD** - Full rebuild on every change with error classification and alerting
3. **Cross-Platform Device Management** - Automated provisioning of all devices with consistent extensions
4. **Observability & Alerting** - Monitors everything, alerts when human intervention needed

## Quick Start

```powershell
# Run complete setup
.\scripts\hc-infrastructure-setup.ps1 -Mode full-setup

# Or step by step
.\scripts\hc-infrastructure-setup.ps1 -Mode inventory    # Find api.headysystems.com refs
.\scripts\hc-infrastructure-setup.ps1 -Mode migrate      # Replace with domains
.\scripts\hc-infrastructure-setup.ps1 -Mode provision   # Install everything
.\scripts\hc-infrastructure-setup.ps1 -Mode clean-build # Build from scratch
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HEADI INFRASTRUCTURE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │   api.headysystems.com  │────▶│   Service    │────▶│   Clean      │           │
│  │   Inventory  │     │   Domains    │     │   Build      │           │
│  └──────────────┘     └──────────────┘     └──────────────┘           │
│         │                    │                    │                   │
│         ▼                    ▼                    ▼                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │   Hosts      │     │   Device     │     │   CI/CD      │           │
│  │   File       │     │   Provision  │     │   Pipeline   │           │
│  └──────────────┘     └──────────────┘     └──────────────┘           │
│         │                    │                    │                   │
│         └────────────────────┴────────────────────┘                   │
│                              │                                        │
│                              ▼                                        │
│                    ┌──────────────────┐                               │
│                    │   Alert & Notify │◀─── Human Intervention        │
│                    └──────────────────┘                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Service Domains

| Service | Old (api.headysystems.com) | New (Domain) | Port |
|---------|-----------------|--------------|------|
| Heady Manager | api.headysystems.com:3300 | manager.headysystems.com | 3300 |
| Python Worker | api.headysystems.com:5000 | worker.headysystems.com | 5000 |
| Web Dashboard | api.headysystems.com:3000 | dashboard.headysystems.com | 3000 |
| Public Site | api.headysystems.com:8080 | www.headysystems.com | 8080 |
| API Gateway | api.headysystems.com:8081 | api.headysystems.com | 8081 |
| Redis Cache | api.headysystems.com:6379 | cache.headysystems.com | 6379 |
| PostgreSQL | api.headysystems.com:5432 | db.headysystems.com | 5432 |
| Prometheus | api.headysystems.com:9090 | metrics.headysystems.com | 9090 |
| Grafana | api.headysystems.com:3001 | grafana.headysystems.com | 3001 |
| Imagination | api.headysystems.com:3400 | imagination.headysystems.com | 3400 |
| Jaeger Tracing | api.headysystems.com:16686 | traces.headysystems.com | 16686 |
| AlertManager | api.headysystems.com:9093 | alerts.headysystems.com | 9093 |

## Clean-Build CI/CD

### Philosophy

**Every change triggers a full clean build.** No incremental artifacts, no cached dependencies in CI.

**If build fails:**
- ❌ NO automatic rebuild
- ✅ Error is classified (network/code/resource/permission)
- ✅ Alert sent via webhook + desktop notification
- ✅ Human must fix and retry manually

### GitHub Actions Workflow

```yaml
# configs/workflows/clean-build.yml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 3 * * *'  # Nightly clean build
```

**Jobs:**
1. **Pre-flight** - Check for api.headysystems.com references
2. **Build Manager** - Clean Node.js build (npm ci, no cache)
3. **Build Frontend** - React build
4. **Build Worker** - Python + Docker
5. **Integration Tests** - Full stack test
6. **Security Scan** - Trivy vulnerability check
7. **Deploy Staging** - Auto on develop branch
8. **Deploy Production** - Manual approval on main

### Local Clean Build

```powershell
# Before every commit - ensures CI will pass
.\scripts\hc-infrastructure-setup.ps1 -Mode clean-build

# Or manually:
Remove-Item -Recurse -Force node_modules, dist
npm cache clean --force
npm ci
npm run lint
npm test
npm run build
```

## Device Provisioning

### Windows (PowerShell)

```powershell
# Install everything
.\scripts\hc-infrastructure-setup.ps1 -Mode provision

# Installs:
# - Chocolatey package manager
# - Chrome, Firefox, Edge with extensions
# - VS Code + extensions
# - Node.js 20.18.1, Python 3.12.7
# - Docker Desktop
# - Git, 1Password, Slack, Discord
```

### macOS (Homebrew)

```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then run provision mode
./scripts/hc-infrastructure-setup.ps1 -Mode provision
```

### Linux (APT/Ansible)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y git nodejs npm python3 docker.io

# Or use the Ansible playbook
ansible-playbook device-provision.yml
```

## Browser Extensions (Golden List)

### Chrome/Edge (Development Profile)

| Extension | ID | Purpose |
|-----------|-----|---------|
| React Developer Tools | fmkadmapgofadopljbjfkapdkoienihi | React debugging |
| Redux DevTools | lmhkpmbekcpmknklioeibfkpmmfibljd | State inspection |
| Heady Companion | (local) | Heady integration |
| Wappalyzer | cjbacpjgakmemgfjfhgnhifnidbeole | Tech detection |
| Advanced REST Client | gmmkjhbhbpkjgcdfjhmpofhgefmlbmad | API testing |
| uBlock Origin | gighmmpiobklfepjocnamgkkbiglidom | Ad/tracker block |

### Security Profile (Minimal)

Use separate browser profile for banking/sensitive sites with NO extensions except password manager.

## IDE Extensions (VS Code)

### Core Language Support
- TypeScript/JavaScript (ms-vscode.vscode-typescript-next)
- Python (ms-python.python)
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- YAML (redhat.vscode-yaml)

### DevOps & Tools
- Docker (ms-azuretools.vscode-docker)
- Kubernetes (ms-kubernetes-tools.vscode-kubernetes-tools)
- GitLens (eamodio.gitlens)
- GitHub Copilot (github.copilot)

### Heady-Specific
- Heady Dev Companion (local from `distribution/ide/vscode/`)

## Observability & Alerting

### Monitoring Stack

| Component | Domain | Purpose |
|-----------|--------|---------|
| Prometheus | metrics.headysystems.com | Metrics collection |
| Grafana | grafana.headysystems.com | Dashboards |
| Jaeger | traces.headysystems.com | Distributed tracing |
| AlertManager | alerts.headysystems.com | Alert routing |

### Alert Severity Levels

**Critical (Page immediately):**
- Heady Manager DOWN
- Database connection lost
- Security breach detected

**Warning (Slack notification):**
- High memory usage (>85%)
- Slow response times (p95 > 1s)
- Low disk space (<15%)
- Backup failed

**Info (Log only):**
- Deployment completed
- Service started

### Notification Channels

1. **Slack** - Team visibility, threaded discussions
2. **Signal** - Personal critical alerts
3. **Email** - Daily digest, detailed reports
4. **Desktop** - Local dev notifications

## Configuration Files

| File | Purpose |
|------|---------|
| `configs/service-domains.yaml` | Domain mappings and service definitions |
| `configs/device-management.yaml` | MDM profiles and extension lists |
| `configs/observability.yaml` | Monitoring and alerting rules |
| `.github/workflows/clean-build.yml` | CI/CD pipeline |
| `scripts/hc-infrastructure-setup.ps1` | Main setup script |

## Environment-Specific Setup

### Local Development

All services run on api.headysystems.com but accessed via domains through hosts file.

```powershell
# Verify domains work
curl http://manager.headysystems.com:3300/api/health
curl http://dashboard.headysystems.com:3000
```

### Staging

- Subdomain: `*.staging.headysystems.comheady.systems`
- Auto-deploy from `develop` branch
- Reduced resources, test data

### Production

- Public domains: `*.heady.systems`
- Manual approval for deploys
- Full monitoring, multi-region capable

## Troubleshooting

### DNS Not Resolving

```powershell
# Windows
ipconfig /flushdns

# macOS  
sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches
```

### Build Fails

```powershell
# Check for api.headysystems.com references
.\scripts\hc-infrastructure-setup.ps1 -Mode inventory

# Clean everything and retry
Remove-Item -Recurse -Force node_modules, dist, .heady_cache
npm cache clean --force
.\scripts\hc-infrastructure-setup.ps1 -Mode clean-build
```

### Extension Won't Load

**Chrome:**
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. "Load unpacked" → select `distribution/browser/extensions/chrome/`

**VS Code:**
1. Extensions view (Ctrl+Shift+X)
2. "..." menu → "Install from VSIX"
3. Select `distribution/ide/vscode/*.vsix`

## Maintenance

### Weekly

```powershell
# 1. Verify clean build works
.\scripts\hc-infrastructure-setup.ps1 -Mode clean-build

# 2. Check for drift
.\scripts\hc-infrastructure-setup.ps1 -Mode inventory

# 3. Review and update dependencies
npm outdated
```

### Monthly

1. Rotate secrets and API keys
2. Update browser/IDE extensions
3. Review disk usage across all nodes
4. Verify backup integrity
5. Tune alert thresholds

## Error Handling Philosophy

### What Happens on Build Failure?

1. **Classification:** Error type identified (network/code/resource/permission)
2. **Alerting:** Notification sent via Slack/Signal/Desktop
3. **NO Auto-Rebuild:** Human must investigate and fix
4. **Retry:** After fix, manually run clean-build again

### Configure Alerts

```powershell
# Set webhook for notifications
$env:HEADY_ALERT_WEBHOOK = "https://hooks.slack.com/services/YOUR/WEBHOOK"

# Run build with alerting enabled
.\scripts\hc-infrastructure-setup.ps1 -Mode clean-build
```

## Security Considerations

### Domain-Based Security

- **Public zone:** `*.heady.systems` - Internet-facing, full security
- **Internal zone:** `*.headysystems.comheady.systems` - VPN/mesh required
- **Local zone:** `*.headysystems.com` - Development only, hosts file

### Network Policies

```yaml
# Example Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-internal-only
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              access: db
```

### Post-Quantum Certificate Deployment

Heady Systems supports hybrid post-quantum cryptography for all internal mTLS communications. This provides protection against "harvest now, decrypt later" attacks.

#### Certificate Hierarchy

```
Root CA (20 year validity)
└── Intermediate CA (5 year validity)
    ├── Server Certificates (1 year validity)
    └── Client Certificates (1 year validity)
```

#### Key Algorithms
- **Key Exchange:** X25519 + Kyber768 (hybrid)
- **Signatures:** Dilithium5
- **Encryption:** AES-256-GCM

#### Deployment Steps

1. **Initialize PKI**
```powershell
./configs/pki/scripts/init-ca.sh
```

2. **Issue Certificates**
```powershell
# Server certificate
./configs/pki/scripts/issue-cert.sh server api.headysystems.com

# Client certificate
./configs/pki/scripts/issue-cert.sh client nginx.headysystems.com
```

3. **Configure Services**
- Nginx: Update `mtls.conf` with new certificate paths
- Node.js: Use `tls.createSecureContext` with PQ cipher suites
- Python: Configure SSLContext with PQ support

4. **Rotate Certificates**
- Server certificates: Annual rotation
- Intermediate CA: Every 5 years
- Root CA: Every 20 years

#### Verification
```powershell
# Check certificate details
openssl x509 -in /etc/nginx/ssl/pki/intermediate/certs/server.pem -text -noout

# Verify TLS connection
openssl s_client -connect api.headysystems.com:8443 -showcerts
```

## Migration from api.headysystems.com

### Step 1: Inventory

```powershell
.\scripts\hc-infrastructure-setup.ps1 -Mode inventory
# Generates CSV with all api.headysystems.com references
```

### Step 2: Migrate

```powershell
.\scripts\hc-infrastructure-setup.ps1 -Mode migrate
# Replaces api.headysystems.com with domains
# Updates hosts file
# Backs up original hosts
```

### Step 3: Verify

```powershell
# Test each service
curl http://manager.headysystems.com:3300/api/health
curl http://worker.headysystems.com:5000/health
curl http://dashboard.headysystems.com:3000
```

## Support

- **Documentation:** https://docs.heady.io/infrastructure
- **Runbooks:** https://docs.heady.io/runbooks/
- **Issues:** https://github.com/HeadySystems/Heady/issues
- **Alerts:** Check #heady-alerts Slack channel

## License

MIT - See LICENSE file

---

*Part of the Heady Sacred Geometry Infrastructure*
*Clean builds | Domain-driven | Alert-driven | Human-in-the-loop*

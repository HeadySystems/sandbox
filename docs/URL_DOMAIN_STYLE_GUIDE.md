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
<!-- ║  FILE: docs/URL_DOMAIN_STYLE_GUIDE.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
file_id: "FMSAP-005"
title: "URL Domain Style Guide"
created: 2026-02-10
last_scan: 2026-02-10T03:39:00Z
scan_count: 1
next_scan_due: 2026-02-17
scan_priority: "high"
stability: "stable"
criticality: "core"
maintenance_notes:
  - "Initial protocol creation"
dependencies:
  - "SYSTEM_PROMPT.md"
  - "ITERATIVE_REBUILD_PROTOCOL.md"
learned_insights:
  - count: 0
  - last_updated: null
improvement_backlog: []
---
# Heady Systems URL and Domain Style Guide
# Production-ready standards for all user-facing content

## Overview

This guide establishes the canonical URL and domain patterns for Heady Systems. All documentation, code examples, screenshots, and user-facing materials must follow these standards.

## Core Principles

1. **Never expose api.headysystems.com or internal IPs** in user-facing content
2. **Use HTTPS everywhere** for production domains
3. **Maintain consistent domain hierarchy** across all environments
4. **Follow security best practices** for all URL patterns

## Domain Architecture

### Primary Domains

| Purpose | Domain | Environment | SSL Required |
|---------|--------|-------------|--------------|
| Nonprofit umbrella | `headyconnection.org` | Production | Yes |
| Commercial hub | `headysystems.com` | Production | Yes |
| Peer support program | `headybuddy.org` | Production | Yes |

### API Subdomains

| Service | Domain | Backend Port | Purpose |
|---------|--------|--------------|---------|
| Commercial API | `api.headysystems.com` | 8000 | Main commercial API |
| Nonprofit API | `api.headyconnection.org` | 8001 | Nonprofit API |
| Web applications | `app.headysystems.com` | 3000 | Main web app |
| Admin dashboards | `admin.headysystems.com` | 3001 | Admin interface |

### Development Domains

| Environment | Domain Pattern | Example |
|-------------|---------------|---------|
| Local development | `*.headysystems.com` | `app.headysystems.com` |
| Development server | `dev.headysystems.com` | `dev.headysystems.com` |
| Staging server | `staging.headysystems.com` | `staging.headysystems.com` |

## URL Patterns

### API Endpoints

#### Correct Examples
```
https://api.headysystems.com/v1/users
https://api.headyconnection.org/v1/donations
https://api.headysystems.com/v1/auth/login
```

#### Incorrect Examples (NEVER use)
```
https://api.headysystems.com/api/v1/users
http://api.headysystems.com:8001/api/v1/donations
http://10.0.1.50:8000/api/v1/auth/login
```

### Web Applications

#### Correct Examples
```
https://app.headysystems.com/dashboard
https://app.headyconnection.org/programs
https://headybuddy.org/connect
```

#### Incorrect Examples (NEVER use)
```
https://app.headysystems.com/dashboard
http://api.headysystems.com:3002/programs
http://192.168.1.100:4000/connect
```

### OAuth Callback URLs

#### Production Callbacks
```
https://app.headysystems.com/oauth/callback
https://app.headyconnection.org/oauth/callback
https://headybuddy.org/oauth/callback
```

#### Development Callbacks
```
https://app.headysystems.com/oauth/callback
https://api.headysystems.com/oauth/callback
```

#### Incorrect Examples (NEVER use)
```
https://app.headysystems.com/oauth/callback
http://https://api.headysystems.com/oauth/callback
```

### WebSocket Connections

#### Correct Examples
```
wss://realtime.headysystems.com/socket
wss://ws.headysystems.com/socket
```

#### Incorrect Examples (NEVER use)
```
ws://api.headysystems.com:4000/socket
ws://api.headysystems.com:4000/socket
```

## Environment-Specific Guidelines

### Production Environment
- **Protocol**: HTTPS only
- **Domains**: `*.headysystems.com`, `*.headyconnection.org`, `headybuddy.org`
- **SSL**: Valid certificates required (Let's Encrypt recommended)
- **Headers**: Full security headers applied

### Staging Environment
- **Protocol**: HTTPS
- **Domains**: `staging.headysystems.com`
- **SSL**: Self-signed or staging certificates
- **Headers**: Full security headers applied

### Local Development
- **Protocol**: HTTP (for simplicity)
- **Domains**: `*.headysystems.com`
- **SSL**: Optional (self-signed)
- **Headers**: Development-friendly CORS

## Code Examples

### cURL Commands

#### Correct
```bash
curl https://api.headysystems.com/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### Incorrect
```bash
curl https://api.headysystems.com/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### JavaScript Fetch

#### Correct
```javascript
const response = await fetch('https://api.headysystems.com/v1/users', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

#### Incorrect
```javascript
const response = await fetch('http://api.headysystems.com:8000/api/v1/users', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Python Requests

#### Correct
```python
import requests

response = requests.get(
    'https://api.headysystems.com/v1/users',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)
```

#### Incorrect
```python
import requests

response = requests.get(
    'http://api.headysystems.com:8000/api/v1/users',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)
```

## Configuration Files

### Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name api.headysystems.com;
    
    location / {
        proxy_pass http://https://api.headysystems.com;
        # ... other config
    }
}
```

### Environment Variables
```bash
# Correct
API_BASE_URL=https://api.headysystems.com
WEB_APP_URL=https://app.headysystems.com

# Incorrect
API_BASE_URL=http://api.headysystems.com:8000
WEB_APP_URL=http://api.headysystems.com:3000
```

## Documentation Standards

### README Files
Always use production domains in examples:
```markdown
## Quick Start

1. Clone the repository
2. Set up environment variables:
   ```bash
   API_BASE_URL=https://api.headysystems.com
   ```
3. Run the application
4. Visit https://app.headysystems.com
```

### API Documentation
Use production domains in all examples:
```markdown
# Authentication

POST https://api.headysystems.com/v1/auth/login

{
  "email": "user@example.com",
  "password": "password"
}
```

### Screenshots and Demos
- Never show api.headysystems.com URLs in screenshots
- Use production or staging domains
- Blur or replace any internal IPs that appear

## Local Development Setup

### 1. Configure /etc/hosts
```bash
# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
api.headysystems.com app.headysystems.com
api.headysystems.com api.headysystems.com
api.headysystems.com admin.headysystems.com
api.headysystems.com buddy.headysystems.com
```

### 2. Configure Nginx
Use the provided local development configuration:
```bash
# Enable local development site
sudo ln -s /etc/nginx/sites-available/local-dev.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Update Application Config
```python
# settings/local.py
ALLOWED_HOSTS = ['*.headysystems.com', 'api.headysystems.com', 'api.headysystems.com']
CORS_ALLOWED_ORIGINS = ['http://*.headysystems.com']
```

## Security Considerations

### Why This Matters
1. **Prevents information leakage** about internal network structure
2. **Reduces configuration errors** when moving between environments
3. **Improves security posture** by not exposing internal endpoints
4. **Enhances user experience** with consistent, professional URLs

### Common Mistakes to Avoid
1. **Using api.headysystems.com in documentation** - users will copy-paste these examples
2. **Hardcoding internal IPs** - makes code environment-specific
3. **Mixed HTTP/HTTPS** - causes CORS and security issues
4. **Inconsistent domain patterns** - confuses users and developers

## Validation and Testing

### Automated Checks
Add this to your CI/CD pipeline:
```bash
#!/bin/bash
# Check for api.headysystems.com references in documentation
if grep -r "api.headysystems.com\|127\.0\.0\.1\|10\.\|192\.168\.\|172\.1[6-9]\.\|172\.2[0-9]\.\|172\.3[0-1]\." docs/; then
  echo "ERROR: Found api.headysystems.com/internal IP references in documentation"
  exit 1
fi

# Check for api.headysystems.com in configuration files
if grep -r "api.headysystems.com\|127\.0\.0\.1" configs/ --exclude="local-dev.conf"; then
  echo "ERROR: Found api.headysystems.com references in production configs"
  exit 1
fi
```

### Manual Review Checklist
- [ ] No api.headysystems.com URLs in user-facing documentation
- [ ] No internal IPs in code examples
- [ ] All examples use HTTPS for production
- [ ] OAuth callbacks use correct domains
- [ ] Screenshots show proper domains
- [ ] Configuration files use environment variables

## Migration Checklist

When updating existing content:

1. **Search and Replace**
   - `http://api.headysystems.com:3000` → `https://app.headysystems.com`
   - `http://api.headysystems.com:8000` → `https://api.headysystems.com`
   - `https://app.headysystems.com` → `https://app.headysystems.com`
   - `api.headysystems.com:8000` → `https://api.headysystems.com`

2. **Update Configuration**
   - Replace hardcoded URLs with environment variables
   - Update OAuth callback URLs
   - Modify CORS settings

3. **Test Changes**
   - Verify all links work
   - Test authentication flows
   - Check API documentation

4. **Update Documentation**
   - README files
   - API documentation
   - Developer guides
   - User manuals

## Support and Questions

For questions about this style guide:
- Check the `configs/domain-architecture.yaml` for canonical domain mappings
- Review the Nginx configurations in `configs/nginx/`
- Contact the DevOps team for environment-specific questions

Remember: **Consistency prevents errors and improves security**. Always follow these patterns in your Heady Systems work.

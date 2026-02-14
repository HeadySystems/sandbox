# HeadyVM Setup & Windsurf Integration Guide

## 🎯 Overview

This guide provides comprehensive instructions for setting up HeadyVM with Windsurf IDE integration for optimal Heady Systems development experience.

## 📋 Prerequisites

### System Requirements
- **Windows 10/11** (with PowerShell 7+)
- **HeadyVM** (running and accessible via SSH)
- **Windsurf IDE** (installed and in PATH)
- **SSH Client** (Windows OpenSSH or PuTTY)
- **Git** (for version control)

### Network Requirements
- HeadyVM accessible via SSH (port 22)
- HeadyVM services accessible (ports 3301, 3000, 8080)
- Stable network connection

### Workspace Requirements
- Heady Systems workspace directory
- Admin privileges for initial setup
- Sufficient disk space for sync

## 🚀 Quick Start (Recommended)

### One-Click Setup
```powershell
# Navigate to Heady workspace
cd C:\Users\erich\Heady

# Run quick start script
.\scripts\headyvm-quick-start.ps1
```

### What Quick Start Does
1. ✅ Checks prerequisites
2. ✅ Configures HeadyVM
3. ✅ Sets up Windsurf integration
4. ✅ Starts all services
5. ✅ Performs initial sync
6. ✅ Opens Windsurf with workspace

## 🔧 Manual Setup

### Step 1: HeadyVM Configuration
```powershell
# Configure HeadyVM for Heady Systems
.\scripts\headyvm-setup.ps1 -Mode config-only
```

### Step 2: Windsurf Integration
```powershell
# Set up Windsurf integration
.\scripts\headyvm-windsurf-integration.ps1 -Action setup
```

### Step 3: Start Services
```powershell
# Start HeadyVM services
.\scripts\headyvm-windsurf-integration.ps1 -Action start
```

### Step 4: Initial Sync
```powershell
# Perform initial workspace sync
.\scripts\headyvm-sync.ps1 -Action sync
```

### Step 5: Open Windsurf
```powershell
# Launch Windsurf with workspace
windsurf C:\Users\erich\Heady
```

## 📁 Configuration Files

### Windsurf Workspace Configuration
**Location**: `.windsurf/headyvm-workspace.json`

```json
{
  "version": "2.0",
  "name": "Heady Systems Development",
  "workspace": {
    "path": "C:\\Users\\erich\\Heady",
    "type": "heady-systems",
    "remote": {
      "enabled": true,
      "host": "headyvm.local",
      "user": "heady",
      "path": "/home/heady/heady-sync"
    }
  },
  "services": [
    {
      "name": "heady-manager",
      "localPort": 3301,
      "remoteUrl": "http://headyvm.local:3301",
      "healthEndpoint": "/api/health",
      "autoStart": true,
      "monitoring": true
    }
  ],
  "sync": {
    "enabled": true,
    "interval": 30,
    "direction": "bidirectional",
    "exclude": ["node_modules/**", ".git/**", "dist/**"],
    "conflictResolution": "local-wins",
    "compression": true,
    "encryption": true
  }
}
```

### Sync Configuration
**Location**: `.windsurf/sync-exclude.txt`

```
# HeadyVM Sync Exclusions
node_modules/
.git/
dist/
build/
*.log
.DS_Store
Thumbs.db
.env*
coverage/
.nyc_output/
.vscode/settings.json
.idea/
*.tmp
*.temp
.cache/
```

## 🔄 Sync Operations

### Manual Sync Commands
```powershell
# Sync workspace to HeadyVM
.\scripts\headyvm-sync.ps1 -Action sync

# Push local changes only
.\scripts\headyvm-sync.ps1 -Action push

# Pull remote changes only
.\scripts\headyvm-sync.ps1 -Action pull

# Check sync status
.\scripts\headyvm-sync.ps1 -Action status
```

### Automatic Sync
- **Interval**: Every 30 seconds
- **Direction**: Bidirectional
- **Conflict Resolution**: Local wins
- **Compression**: Enabled
- **Encryption**: Enabled

## 🛠️ Service Management

### Service Commands
```powershell
# Start all services
.\scripts\headyvm-windsurf-integration.ps1 -Action start

# Stop all services
.\scripts\headyvm-windsurf-integration.ps1 -Action stop

# Restart all services
.\scripts\headyvm-windsurf-integration.ps1 -Action restart

# Check service status
.\scripts\headyvm-windsurf-integration.ps1 -Action status

# Monitor services (real-time)
.\scripts\headyvm-windsurf-integration.ps1 -Action monitor
```

### Available Services
| Service | Port | Health Endpoint | Description |
|---------|------|----------------|-------------|
| HeadyManager | 3301 | `/api/health` | Main API service |
| HeadyBuddy | 3000 | `/health` | AI companion service |
| HeadyWeb | 8080 | `/api/status` | Browser service |

## 📊 Monitoring & Status

### Real-time Monitoring
```powershell
# Start real-time monitoring
.\scripts\headyvm-windsurf-integration.ps1 -Action monitor
```

### Status Information
- **CPU Usage**: Current CPU utilization
- **Memory Usage**: RAM usage percentage
- **Disk Usage**: Storage utilization
- **Service Status**: Active/inactive/failed
- **Network Status**: Service responsiveness

### Health Checks
```powershell
# Check Heady Manager health
curl http://headyvm.local:3301/api/health

# Check Brain API health
curl http://headyvm.local:3301/api/brain/health

# Check resource health
curl http://headyvm.local:3301/api/resources/health
```

## 🔌 Windsurf Integration Features

### Integrated Terminal Commands
- **Sync**: `headyvm-sync`
- **Status**: `headyvm-status`
- **Start**: `headyvm-start`
- **Stop**: `headyvm-stop`
- **Monitor**: `headyvm-monitor`

### Debug Configuration
**Location**: `.windsurf/.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch HeadyManager on HeadyVM",
      "type": "node",
      "request": "launch",
      "program": "C:\\Users\\erich\\Heady\\heady-manager.js",
      "cwd": "C:\\Users\\erich\\Heady",
      "env": {
        "NODE_ENV": "development",
        "HEADY_VM_MODE": "true",
        "HEADY_WINDSURF": "true"
      },
      "console": "integratedTerminal",
      "remote": {
        "host": "headyvm.local",
        "user": "heady",
        "workspace": "/home/heady/heady-sync"
      }
    }
  ]
}
```

### Task Automation
**Location**: `.windsurf/.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Sync to HeadyVM",
      "type": "shell",
      "command": "powershell",
      "args": [
        "-ExecutionPolicy", "Bypass",
        "-File", "scripts/headyvm-sync.ps1",
        "-Action", "sync"
      ],
      "group": "build"
    },
    {
      "label": "Start HeadyVM Services",
      "type": "shell",
      "command": "ssh",
      "args": ["heady@headyvm.local", "systemctl start heady-manager"],
      "group": "build"
    }
  ]
}
```

## 🌐 Access Points

### Local Development URLs
- **Heady Manager**: `http://localhost:3301`
- **Heady Manager API**: `http://localhost:3301/api/health`
- **Brain API**: `http://localhost:3301/api/brain/health`
- **Resources**: `http://localhost:3301/api/resources/health`

### HeadyVM URLs
- **Heady Manager**: `http://headyvm.local:3301`
- **HeadyBuddy**: `http://headyvm.local:3000`
- **HeadyWeb**: `http://headyvm.local:8080`

### Cloud Services
- **Heady Cloud**: `https://headysystems.com/api`
- **Heady Brain**: `https://brain.headysystems.com`
- **Heady Registry**: `https://headysystems.com/api/registry`

## 🔧 Troubleshooting

### Common Issues

#### SSH Connection Failed
```powershell
# Test SSH connectivity
ssh heady@headyvm.local "echo 'SSH working'"

# Check SSH keys
ssh-add -l

# Add SSH key if needed
ssh-add ~/.ssh/headyvm_key
```

#### Services Not Starting
```powershell
# Check service status
ssh heady@headyvm.local "systemctl status heady-manager"

# Check service logs
ssh heady@headyvm.local "journalctl -u heady-manager -f"

# Restart service
ssh heady@headyvm.local "systemctl restart heady-manager"
```

#### Sync Issues
```powershell
# Check sync status
.\scripts\headyvm-sync.ps1 -Action status

# Force sync
.\scripts\headyvm-sync.ps1 -Action sync -Force

# Check exclude file
Get-Content .windsurf/sync-exclude.txt
```

#### Windsurf Integration Issues
```powershell
# Re-setup Windsurf integration
.\scripts\headyvm-windsurf-integration.ps1 -Action setup -Force

# Check configuration
Get-Content .windsurf/headyvm-workspace.json

# Reset configuration
Remove-Item .windsurf/headyvm-workspace.json -Force
.\scripts\headyvm-windsurf-integration.ps1 -Action setup
```

### Performance Optimization

#### Sync Performance
- Reduce sync interval for frequent changes
- Exclude large directories from sync
- Use compression for large files
- Monitor network bandwidth

#### Service Performance
- Monitor resource usage
- Optimize service configuration
- Use caching for API responses
- Implement connection pooling

## 📚 Advanced Configuration

### Custom Sync Rules
```json
{
  "sync": {
    "customRules": [
      {
        "pattern": "*.log",
        "action": "ignore"
      },
      {
        "pattern": "src/**/*.js",
        "action": "compress",
        "priority": "high"
      }
    ]
  }
}
```

### Resource Limits
```json
{
  "resourceLimits": {
    "maxMemory": "4GB",
    "maxCpu": "2",
    "maxDisk": "50GB",
    "maxNetwork": "100Mbps"
  }
}
```

### Monitoring Configuration
```json
{
  "monitoring": {
    "enabled": true,
    "metrics": ["cpu", "memory", "disk", "network"],
    "alerts": {
      "cpuThreshold": 80,
      "memoryThreshold": 85,
      "diskThreshold": 90,
      "networkThreshold": 80
    },
    "notifications": {
      "email": false,
      "desktop": true,
      "webhook": null
    }
  }
}
```

## 🔄 Maintenance

### Daily Tasks
- Check service status
- Review sync logs
- Monitor resource usage
- Update dependencies

### Weekly Tasks
- Clean up old logs
- Review configuration
- Update HeadyVM
- Backup workspace

### Monthly Tasks
- Full system audit
- Performance review
- Security updates
- Documentation updates

## 📞 Support

### Getting Help
- **Documentation**: `docs/HeadyVM-Guide.md`
- **Troubleshooting**: `docs/HeadyVM-Troubleshooting.md`
- **Configuration**: `docs/HeadyVM-Configuration.md`
- **Community**: Heady Systems Discord

### Reporting Issues
1. Check existing issues
2. Gather system information
3. Collect error logs
4. Create detailed report
5. Include configuration files

---

**Last Updated**: 2026-02-14
**Version**: 2.0
**Compatible**: HeadyVM v2.0+, Windsurf v2.0+

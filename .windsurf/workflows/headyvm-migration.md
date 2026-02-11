---
description: HeadyVM Migration Workflow - Automated migration to HeadyVM with Windsurf integration
---

## Overview
This workflow handles the complete migration of the Heady system to HeadyVM, including readiness checks, automated deployment, and Windsurf integration.

## Prerequisites
- All foundation services must be operational
- System must pass readiness checks (5/5 score)
- Backup of current state required
- DNS access for domain updates

## Migration Steps

### 1. Readiness Check
```powershell
# Run readiness checker
.\scripts\headyvm-readiness-checker.ps1

# Force check if needed
.\scripts\headyvm-readiness-checker.ps1 -Force

# Auto-deploy if ready
.\scripts\headyvm-readiness-checker.ps1 -AutoDeployIfReady
```

### 2. Pre-Migration Backup
- Automatic backup created at `backups\headyvm-migration-YYYYMMDD-HHMMSS`
- Includes configs, registry, docker-compose, and critical services
- Backup verified before proceeding

### 3. Configuration Updates
- Updates `system-self-awareness.yaml` with migration status
- Modifies `docker-compose.yml` for VM endpoints
- Updates all service configurations for remote deployment

### 4. VM Deployment
- Verifies HeadyVM connectivity
- Triggers deployment pipeline via API
- Monitors deployment job status
- Handles forced deployment if needed

### 5. DNS and Routing Updates
- Manual DNS record updates required:
  - api.headysystems.com -> HeadyVM IP
  - brain.headysystems.com -> HeadyVM IP
  - manager.headysystems.com -> HeadyVM IP
  - registry.headysystems.com -> HeadyVM IP

### 6. Post-Migration Verification
- Health checks on all VM endpoints
- Service functionality validation
- Creation of migration completion marker

## Integration with Auto-Deploy

The auto-deploy pipeline (`run-auto-deploy.ps1`) automatically:
1. Checks for existing readiness marker (`.headyvm-ready`)
2. Re-runs readiness check if marker is >1 hour old
3. Triggers migration if system is ready and production gates pass
4. Provides manual migration command when ready

## Windsurf Integration

When system is ready for HeadyVM and Windsurf migration:
1. Auto-deploy detects readiness
2. Runs HeadyVM migration script
3. Updates Windsurf configuration for VM endpoints
4. Migrates Windsurf workspace settings
5. Validates Windsurf connectivity to VM

## Rollback Procedure

If migration fails:
1. Restore from backup: `.\scripts\headyvm-rollback.ps1`
2. Update DNS back to original endpoints
3. Verify local services are running
4. Clear migration markers: `rm .headyvm-ready .headyvm-migrated`

## Monitoring

Post-migration monitoring checklist:
- [ ] All health endpoints return 200
- [ ] API responses under 500ms
- [ ] Brain service training jobs complete
- [ ] Registry synchronization working
- [ ] No error spikes in logs
- [ ] Memory usage < 80% on VM

## Troubleshooting

### Common Issues
1. **VM Connectivity**: Check firewall rules and security groups
2. **DNS Propagation**: May take up to 24 hours
3. **Service Failures**: Check VM logs via `/api/logs` endpoint
4. **Authentication**: Verify API keys on VM environment

### Emergency Commands
```powershell
# Force migration (bypass all checks)
.\scripts\headyvm-migrate.ps1 -Force -SkipReadinessCheck

# Emergency rollback
.\scripts\headyvm-rollback.ps1 -Emergency

# Check migration status
Get-Content .headyvm-migrated | ConvertFrom-Json
```

## Configuration Files

Key configuration files updated during migration:
- `configs/system-self-awareness.yaml` - Migration status tracking
- `configs/cloud-layers.yaml` - VM endpoint configuration
- `configs/foundation-contract.yaml` - VM service definitions
- `docker-compose.yml` - VM-specific deployment config
- `.windsurf/admin-config.yaml` - Windsurf VM endpoints

## Success Criteria

Migration considered successful when:
1. All 5 readiness checks pass
2. All VM health endpoints respond
3. DNS resolves to VM IP
4. Auto-deploy pipeline runs successfully on VM
5. Windsurf connects to VM without errors

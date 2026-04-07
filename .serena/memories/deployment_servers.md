# Deployment Servers

## Server Inventory

| Server | IP | Domain | SSH | Role |
|--------|-----|--------|-----|------|
| DataCraft Systems | 37.60.225.7 | ours.datacraft.systems | `root@37.60.225.7` | Primary production |

## Quick Deploy Commands

```bash
# Remote deployment (from local machine)
cd deployment/scripts

# Deploy to DataCraft
./deploy-remote.sh datacraft deploy

# Check status
./deploy-remote.sh datacraft status

# View logs
./deploy-remote.sh datacraft logs

# Open SSH shell
./deploy-remote.sh datacraft shell

# Sync local code
./deploy-remote.sh datacraft sync
```

## SSH Access

```bash
ssh root@37.60.225.7
# or
ssh root@ours.datacraft.systems
```

## Deployment Files

- `deployment/servers.yaml` - Server configuration
- `deployment/scripts/deploy-remote.sh` - Remote deployment script
- `deployment/scripts/deploy.sh` - Local deployment (run on server)
- `deployment/scripts/01-configure-vps.sh` - Base VPS setup
- `deployment/scripts/04-deploy-app.sh` - Application deployment

## Architecture

```
Internet → Nginx (443/80) → Next.js App (3000) → pgBouncer (6432) → PostgreSQL (5432)
```

## Notes

- **Docker is NOT used** - services run natively via systemd
- PostgreSQL uses pgBouncer for connection pooling
- Nginx handles SSL termination and reverse proxy
- Scrapers run as systemd timers
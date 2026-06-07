# DocuFusion Deployment

Production deployment scripts for DocuFusion on Ubuntu 22.04/24.04 VPS.

## Servers

| Server | IP | Domain | Role |
|--------|-----|--------|------|
| DataCraft Systems | 37.60.225.7 | ours.datacraft.systems | Primary production |

## Quick Start

### Local Deployment (on server)
```bash
# Clone repository
git clone https://github.com/your-org/docfusion.git
cd docfusion/deployment/scripts

# Run full deployment
sudo ./deploy.sh all
```

### Remote Deployment (from local machine)
```bash
# Deploy to DataCraft server
./deploy-remote.sh datacraft deploy

# Check status
./deploy-remote.sh datacraft status

# View logs
./deploy-remote.sh datacraft logs
```

## Deployment Steps

| Step | Script | Description |
|------|--------|-------------|
| 1 | `01-configure-vps.sh` | System updates, firewall, user setup |
| 2 | `02-install-postgresql.sh` | PostgreSQL 16, pgBouncer, backups |
| 3 | `03-install-nginx.sh` | Nginx reverse proxy, SSL config |
| 4 | `04-deploy-app.sh` | Next.js application deployment |
| 5 | `05-deploy-scrapers.sh` | Scraper systemd timers |
| 6 | `06-setup-monitoring.sh` | Monitoring and alerting |

## Prerequisites

- Fresh Ubuntu 22.04 or 24.04 server
- Root or sudo access
- SSH key for authentication
- Domain name pointing to server IP

## Configuration

### Environment Variables

```bash
# Required
export DOMAIN="your-domain.com"
export DEPLOY_USER="docfusion"

# Database
export DB_NAME="docfusion"
export DB_USER="docfusion"
export DB_PASSWORD="your-secure-password"  # Auto-generated if not set

# Application
export REPO_URL="https://github.com/your-org/docfusion.git"
export BRANCH="main"
```

### Step-by-Step Deployment

```bash
# Step 1: Configure VPS
sudo ./deploy.sh vps

# Step 2: Install PostgreSQL
sudo ./deploy.sh postgres

# Step 3: Configure Nginx
sudo ./deploy.sh nginx

# Generate SSL certificates
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Step 4: Deploy Application
sudo ./deploy.sh app

# Step 5: Deploy Scrapers
sudo ./deploy.sh scrapers

# Step 6: Setup Monitoring
sudo ./deploy.sh monitor
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Nginx (443/80)                           │
│  - SSL termination                                           │
│  - Reverse proxy                                             │
│  - Rate limiting                                             │
│  - Security headers                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js App (3000)                         │
│  - systemd service                                           │
│  - Auto-restart on failure                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 pgBouncer (6432) → PostgreSQL (5432)          │
│  - Connection pooling                                        │
│  - Transaction mode                                          │
└─────────────────────────────────────────────────────────────┘
```

## Scraper Schedule

| Tier | Schedule | Priority | Sources |
|------|----------|----------|---------|
| 1 | Every 6h | High | UNGM, DevEx, major donors |
| 2 | Every 12h | Medium | Regional development banks |
| 3 | Daily | Low | Secondary sources |

## Management Commands

### Application

```bash
# Status
sudo systemctl status docfusion

# Logs
sudo journalctl -u docfusion -f

# Restart
sudo systemctl restart docfusion

# Deploy update
sudo docfusion-deploy main
```

### Scrapers

```bash
# Check status
docfusion-scraper all status

# Run immediately
docfusion-scraper 1 run

# View logs
docfusion-scraper 2 logs

# Enable/disable
docfusion-scraper 3 enable
docfusion-scraper 3 disable
```

### Database

```bash
# Connect
psql -h localhost -U docfusion -d docfusion

# Backup
sudo -u postgres pgbackrest --stanza=main backup

# Restore
sudo -u postgres pgbackrest --stanza=main restore
```

### Monitoring

```bash
# Health check
/opt/docfusion/monitoring/health-check.sh

# Scraper status
/opt/docfusion/monitoring/scraper-status.sh

# Node metrics
curl http://localhost:9100/metrics
```

## Security

- UFW firewall (ports 22, 80, 443)
- Fail2ban for SSH
- SSL/TLS with Let's Encrypt
- Security headers in Nginx
- PostgreSQL limited to localhost
- systemd service sandboxing

## Backups

- PostgreSQL: Daily incremental, weekly full (pgBackRest)
- WAL archiving: Continuous
- Logs: 14-day retention
- Application: Git version control

## Troubleshooting

### Application won't start

```bash
# Check logs
sudo journalctl -u docfusion -n 100

# Check database connection
psql -h localhost -U docfusion -d docfusion -c "SELECT 1"

# Check environment
sudo -u docfusion cat /opt/docfusion/app/frontend/.env.production
```

### Scrapers not running

```bash
# Check timer status
systemctl list-timers | grep scraper

# Check recent runs
journalctl -u scraper-tier1 -n 50

# Manual run
docfusion-scraper 1 run
```

### SSL certificate issues

```bash
# Renew certificates
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# Check certificate
sudo certbot certificates
```

## Files

```
/opt/docfusion/
├── app/                    # Next.js application
│   └── frontend/
├── backend/                # Python scraper scripts
│   └── discovery/
├── logs/                   # Application logs
├── data/                   # Data files
├── backups/                # Backup storage
├── monitoring/             # Monitoring scripts
│   ├── health-check.sh
│   ├── scraper-status.sh
│   └── send-alert.sh
├── .env.database           # Database credentials
└── .env.alerts             # Alert configuration

/etc/systemd/system/
├── docfusion.service       # Application service
├── docfusion-scraper-tier1.{service,timer}
├── docfusion-scraper-tier2.{service,timer}
├── docfusion-scraper-tier3.{service,timer}
└── node_exporter.service   # Metrics exporter
```

## Scheduled Jobs

### Agent memory cleanup (nightly)

Purges expired rows from the `agent_memories` table at 03:00 UTC.

```bash
# Install
sudo cp deployment/systemd/docfusion-memory-cleanup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now docfusion-memory-cleanup.timer

# Check status
systemctl status docfusion-memory-cleanup.timer

# View last run
journalctl -u docfusion-memory-cleanup.service -n 50

# Run manually
sudo systemctl start docfusion-memory-cleanup.service
```

The service runs `python -m docfusion.agents.memory.cleanup_job` (entry point in
`src/docfusion/agents/memory/cleanup_job.py`). It reads `DATABASE_URL` from the
`EnvironmentFile` at `/home/root/docfusion/.env` and logs the number of
rows purged to the system journal.

## Support

For issues or questions, consult:
- Application logs: `journalctl -u docfusion`
- Scraper logs: `journalctl -u scraper-tier1`
- Nginx logs: `/var/log/nginx/docfusion.*.log`
- Database logs: `/var/log/postgresql/`
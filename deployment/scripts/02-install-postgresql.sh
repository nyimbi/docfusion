#!/bin/bash
# ============================================================================
# DocuFusion PostgreSQL Installation and Configuration
# Run after 01-configure-vps.sh
# ============================================================================

set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-docfusion}"
DB_USER="${DB_USER:-docfusion}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)}"
PG_VERSION="${PG_VERSION:-16}"
DEPLOY_USER="${DEPLOY_USER:-docfusion}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 1. Install PostgreSQL
# ============================================================================

log_info "Installing PostgreSQL ${PG_VERSION}..."

# Add PostgreSQL APT repository
apt-get install -y wget gnupg2 lsb-release

sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

apt-get update
apt-get install -y postgresql-${PG_VERSION} postgresql-contrib-${PG_VERSION} postgresql-client-${PG_VERSION}

# ============================================================================
# 2. Configure PostgreSQL for Production
# ============================================================================

log_info "Configuring PostgreSQL for production..."

PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Get system memory for tuning
TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
SHARED_BUFFERS=$((TOTAL_MEM / 4 / 1024))M
EFFECTIVE_CACHE=$((TOTAL_MEM * 3 / 4 / 1024))M

# Backup original configs
cp "${PG_CONF}" "${PG_CONF}.bak"
cp "${PG_HBA}" "${PG_HBA}.bak"

# Update postgresql.conf
cat >> "${PG_CONF}" << EOF

# ============================================================================
# DocuFusion Production Configuration
# ============================================================================

# Memory
shared_buffers = ${SHARED_BUFFERS}
effective_cache_size = ${EFFECTIVE_CACHE}
work_mem = 64MB
maintenance_work_mem = 512MB
huge_pages = try

# Connections
max_connections = 200
superuser_reserved_connections = 3

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 2GB
min_wal_size = 1GB

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Query Tuning
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100

# Autovacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min

# TimeZone
timezone = 'UTC'
EOF

# ============================================================================
# 3. Configure pg_hba.conf for Security
# ============================================================================

log_info "Configuring pg_hba.conf..."

cat > "${PG_HBA}" << EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections (Unix socket)
local   all             postgres                                peer
local   ${DB_NAME}      ${DB_USER}                              md5

# IPv4 local connections (localhost only)
host    all             all             127.0.0.1/32            md5

# IPv6 local connections (localhost only)
host    all             all             ::1/128                 md5

# Replication (if needed later)
# host    replication     replicator      10.0.0.0/8              md5
EOF

# ============================================================================
# 4. Create Database and User
# ============================================================================

log_info "Creating database and user..."

sudo -u postgres psql << EOF
-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database and grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

log_info "Database created: ${DB_NAME}"
log_info "User created: ${DB_USER}"

# ============================================================================
# 5. Install pgBouncer for Connection Pooling
# ============================================================================

log_info "Installing pgBouncer..."

apt-get install -y pgbouncer

# Configure pgBouncer
cat > /etc/pgbouncer/pgbouncer.ini << EOF
[databases]
${DB_NAME} = host=/var/run/postgresql port=5432 dbname=${DB_NAME}

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
server_reset_query = DISCARD ALL
server_check_query = SELECT 1
server_check_delay = 30
admin_users = postgres
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
EOF

# Create userlist.txt for pgBouncer
echo "\"${DB_USER}\" \"${DB_PASSWORD}\"" > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt

# Enable pgBouncer
systemctl enable pgbouncer
systemctl start pgbouncer

# ============================================================================
# 6. Configure WAL Archiving for Backups
# ============================================================================

log_info "Configuring WAL archiving..."

mkdir -p /var/lib/postgresql/${PG_VERSION}/wal_archive
chown postgres:postgres /var/lib/postgresql/${PG_VERSION}/wal_archive

# Add WAL archiving to postgresql.conf
cat >> "${PG_CONF}" << EOF

# WAL Archiving
archive_mode = on
archive_command = 'test ! -f /var/lib/postgresql/${PG_VERSION}/wal_archive/%f && cp %p /var/lib/postgresql/${PG_VERSION}/wal_archive/%f'
EOF

# ============================================================================
# 7. Configure pgBackRest for Backups
# ============================================================================

log_info "Installing pgBackRest..."

apt-get install -y pgbackrest

# Create pgBackRest configuration
mkdir -p /etc/pgbackrest
mkdir -p /var/lib/pgbackrest
chown postgres:postgres /var/lib/pgbackrest

cat > /etc/pgbackrest/pgbackrest.conf << EOF
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=2
process-max=2
log-level-console=info
log-level-file=detail

[main]
pg1-path=/var/lib/postgresql/${PG_VERSION}/main
pg1-port=5432
pg1-user=postgres
EOF

chown postgres:postgres /etc/pgbackrest/pgbackrest.conf

# Create stanza
sudo -u postgres pgbackrest --stanza=main stanza-create

# ============================================================================
# 8. Set Up Scheduled Backups
# ============================================================================

log_info "Setting up scheduled backups..."

# Daily incremental backup
cat > /etc/cron.d/pgbackrest << 'EOF'
# pgBackRest backup schedule
# Daily incremental at 2 AM
0 2 * * * postgres pgbackrest --stanza=main --type=incr backup

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 postgres pgbackrest --stanza=main --type=full backup
EOF

# ============================================================================
# 9. Restart PostgreSQL
# ============================================================================

log_info "Restarting PostgreSQL..."
systemctl restart postgresql

# Verify PostgreSQL is running
if systemctl is-active --quiet postgresql; then
    log_info "PostgreSQL is running"
else
    log_error "PostgreSQL failed to start"
    exit 1
fi

# ============================================================================
# 10. Store Credentials
# ============================================================================

log_info "Storing database credentials..."

# Create credentials file for application
cat > /opt/docfusion/.env.database << EOF
# PostgreSQL Connection
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:6432/${DB_NAME}"
DATABASE_HOST="localhost"
DATABASE_PORT="6432"
DATABASE_NAME="${DB_NAME}"
DATABASE_USER="${DB_USER}"
DATABASE_PASSWORD="${DB_PASSWORD}"

# Direct connection (no pooling)
DATABASE_URL_DIRECT="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
EOF

chown "${DEPLOY_USER}:${DEPLOY_USER}" /opt/docfusion/.env.database
chmod 600 /opt/docfusion/.env.database

# ============================================================================
# Summary
# ============================================================================

log_info "============================================"
log_info "PostgreSQL Installation Complete!"
log_info "============================================"
log_info ""
log_info "Database: ${DB_NAME}"
log_info "User: ${DB_USER}"
log_info "Port: 5432 (direct), 6432 (pgBouncer)"
log_info ""
log_info "Credentials saved to: /opt/docfusion/.env.database"
log_info ""
log_info "Use connection string:"
log_info "postgresql://${DB_USER}:****@localhost:6432/${DB_NAME}"
log_info ""
log_info "Next steps:"
log_info "1. Run: 03-install-nginx.sh"
log_info "2. Verify database connection:"
log_info "   psql -h localhost -U ${DB_USER} -d ${DB_NAME}"
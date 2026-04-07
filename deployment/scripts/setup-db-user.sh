#!/bin/bash
# ============================================================================
# Setup DocFusion Database User
# Run this on db.lindela.io as postgres superuser
# ============================================================================

set -e

echo "Creating docfusion database user..."

# Connect to PostgreSQL as postgres user
sudo -u postgres psql << 'EOF'
-- Create docfusion user with password
CREATE USER docfusion WITH PASSWORD 'docfusion123' SUPERUSER CREATEDB CREATEROLE;

-- Grant database access
GRANT ALL PRIVILEGES ON DATABASE docfusion TO docfusion;

-- Connect to docfusion database and grant schema privileges
\c docfusion

-- Grant all privileges on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO docfusion;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO docfusion;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO docfusion;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO docfusion;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO docfusion;

-- Make docfusion owner of public schema
GRANT ALL ON SCHEMA public TO docfusion;

EOF

echo "✓ DocFusion user created successfully"
echo ""
echo "Connection string:"
echo "  postgresql://docfusion:docfusion123@db.lindela.io/docfusion"
echo ""
echo "Update .env file with:"
echo "  DATABASE_URL=postgresql://docfusion:docfusion123@db.lindela.io/docfusion"
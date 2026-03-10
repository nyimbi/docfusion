#!/bin/bash
# ============================================================================
# DocuFusion Nginx Installation and SSL Configuration
# Run after 02-install-postgresql.sh
# ============================================================================

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-docfusion.com}"
SERVER_NAME="${SERVER_NAME:-docfusion.com www.docfusion.com}"
APP_PORT="${APP_PORT:-3000}"
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
# 1. Install Nginx
# ============================================================================

log_info "Installing Nginx..."

apt-get install -y nginx

# ============================================================================
# 2. Install Certbot for SSL
# ============================================================================

log_info "Installing Certbot..."

apt-get install -y certbot python3-certbot-nginx

# ============================================================================
# 3. Create Nginx Configuration
# ============================================================================

log_info "Creating Nginx configuration..."

cat > /etc/nginx/sites-available/docfusion << 'NGINX_CONF'
# ============================================================================
# DocuFusion Nginx Configuration
# ============================================================================

# Upstream for Next.js application
upstream docfusion_backend {
    server 127.0.0.1:3000 fail_timeout=10s max_fails=3;
    keepalive 64;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

# SSL session cache
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# Modern SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name SERVER_NAME_PLACEHOLDER;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name SERVER_NAME_PLACEHOLDER;

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://api.openai.com https://api.anthropic.com; frame-ancestors 'self';" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        application/atom+xml
        application/geo+json
        application/javascript
        application/x-javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rdf+xml
        application/rss+xml
        application/xhtml+xml
        application/xml
        font/eot
        font/otf
        font/ttf
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;

    # Brotli compression (if installed)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Logging
    access_log /var/log/nginx/docfusion.access.log;
    error_log /var/log/nginx/docfusion.error.log warn;

    # Root and index
    root /opt/docfusion/app/public;
    index index.html;

    # Client body size for file uploads
    client_max_body_size 50M;

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_conn conn_limit 10;

        proxy_pass http://docfusion_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffering off;
        proxy_request_buffering off;
    }

    # WebSocket support for HMR (development)
    location /_next/webpack-hmr {
        proxy_pass http://docfusion_backend/_next/webpack-hmr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Next.js static files
    location /_next/static/ {
        proxy_pass http://docfusion_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        # Cache static assets
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Public assets
    location /public/ {
        alias /opt/docfusion/app/public/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Main application
    location / {
        limit_req zone=general burst=50 nodelay;
        limit_conn conn_limit 20;

        proxy_pass http://docfusion_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 32k;
    }
}
NGINX_CONF

# Replace placeholders
sed -i "s/SERVER_NAME_PLACEHOLDER/${SERVER_NAME}/g" /etc/nginx/sites-available/docfusion
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/sites-available/docfusion

# Enable site
ln -sf /etc/nginx/sites-available/docfusion /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# ============================================================================
# 4. Create ACME Challenge Directory
# ============================================================================

log_info "Creating ACME challenge directory..."

mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot

# ============================================================================
# 5. Test Nginx Configuration
# ============================================================================

log_info "Testing Nginx configuration..."

# Comment out SSL lines for initial test (no cert yet)
sed -i 's/ssl_certificate/# ssl_certificate/g' /etc/nginx/sites-available/docfusion
sed -i 's/ssl_certificate_key/# ssl_certificate_key/g' /etc/nginx/sites-available/docfusion

if nginx -t; then
    log_info "Nginx configuration valid"
else
    log_error "Nginx configuration error"
    exit 1
fi

# Start Nginx
systemctl enable nginx
systemctl restart nginx

# ============================================================================
# 6. Obtain SSL Certificates (if domain is configured)
# ============================================================================

log_info "Obtaining SSL certificates..."
log_warn "Skipping SSL certificate generation - run manually with:"
log_warn "certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"

# Uncomment SSL lines
sed -i 's/# ssl_certificate/ssl_certificate/g' /etc/nginx/sites-available/docfusion
sed -i 's/# ssl_certificate_key/ssl_certificate_key/g' /etc/nginx/sites-available/docfusion

# ============================================================================
# 7. Configure Auto-Renewal
# ============================================================================

log_info "Configuring SSL auto-renewal..."

# Certbot already adds a systemd timer, verify
systemctl enable certbot.timer
systemctl start certbot.timer

# Create renewal hook for Nginx reload
cat > /etc/letsencrypt/renewal-hooks-deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
# Reload Nginx after certificate renewal
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks-deploy/reload-nginx.sh

# ============================================================================
# 8. Configure Log Rotation
# ============================================================================

log_info "Configuring Nginx log rotation..."

cat > /etc/logrotate.d/nginx-docfusion << 'EOF'
/var/log/nginx/docfusion.*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
EOF

# ============================================================================
# 9. Create Status Page
# ============================================================================

log_info "Creating status endpoint..."

mkdir -p /var/www/html
cat > /var/www/html/status.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>DocuFusion Status</title>
    <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
        .status { color: green; font-weight: bold; }
    </style>
</head>
<body>
    <h1>DocuFusion</h1>
    <p class="status">● Operational</p>
</body>
</html>
EOF

# ============================================================================
# Summary
# ============================================================================

log_info "============================================"
log_info "Nginx Installation Complete!"
log_info "============================================"
log_info ""
log_info "Domain: ${DOMAIN}"
log_info "Application port: ${APP_PORT}"
log_info ""
log_info "Configuration: /etc/nginx/sites-available/docfusion"
log_info "Access log: /var/log/nginx/docfusion.access.log"
log_info "Error log: /var/log/nginx/docfusion.error.log"
log_info ""
log_info "IMPORTANT: Run SSL certificate generation:"
log_info "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
log_info ""
log_info "Next steps:"
log_info "1. Ensure Next.js app is running on port ${APP_PORT}"
log_info "2. Generate SSL certificates with Certbot"
log_info "3. Verify: curl -I https://${DOMAIN}"
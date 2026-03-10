#!/bin/bash
# ============================================================================
# DocuFusion VPS Base Configuration Script
# Run on fresh Azure VM (20.84.71.33) as root or sudo user
# ============================================================================

set -euo pipefail

# Configuration
DEPLOY_USER="${DEPLOY_USER:-docfusion}"
DEPLOY_HOME="/home/${DEPLOY_USER}"
SWAP_SIZE="${SWAP_SIZE:-4G}"
TIMEZONE="${TIMEZONE:-UTC}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 1. System Updates
# ============================================================================

log_info "Updating system packages..."
apt-get update
apt-get upgrade -y
apt-get dist-upgrade -y

# Install essential packages
log_info "Installing essential packages..."
apt-get install -y \
	curl \
	wget \
	git \
	htop \
	tmux \
	ufw \
	fail2ban \
	unattended-upgrades \
	apt-listchanges \
	software-properties-common \
	ca-certificates \
	gnupg \
	lsb-release

# ============================================================================
# 2. Create Deployment User
# ============================================================================

log_info "Creating deployment user: ${DEPLOY_USER}..."

if ! id "${DEPLOY_USER}" &>/dev/null; then
    useradd -m -s /bin/bash "${DEPLOY_USER}"
    log_info "User ${DEPLOY_USER} created"
else
    log_warn "User ${DEPLOY_USER} already exists"
fi

# Add to sudo group
usermod -aG sudo "${DEPLOY_USER}"

# Set up SSH key directory
mkdir -p "${DEPLOY_HOME}/.ssh"
chmod 700 "${DEPLOY_HOME}/.ssh"

# Copy authorized_keys from root if exists
if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys "${DEPLOY_HOME}/.ssh/"
    chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
    log_info "SSH keys copied to ${DEPLOY_USER}"
fi

# ============================================================================
# 3. Configure Firewall (UFW)
# ============================================================================

log_info "Configuring UFW firewall..."

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (rate limited)
ufw limit 22/tcp comment 'SSH rate limited'

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable firewall
ufw --force enable

log_info "UFW status:"
ufw status verbose

# ============================================================================
# 4. Configure Fail2Ban
# ============================================================================

log_info "Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 1h
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# ============================================================================
# 5. Configure Swap
# ============================================================================

log_info "Configuring swap..."

if [ ! -f /swapfile ]; then
    fallocate -l "${SWAP_SIZE}" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Add to fstab
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

    # Configure swappiness (lower = less swap usage)
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf

    log_info "Swap configured (${SWAP_SIZE})"
else
    log_warn "Swap file already exists"
fi

# ============================================================================
# 6. Configure System Limits
# ============================================================================

log_info "Configuring system limits..."

cat > /etc/security/limits.d/docfusion.conf << EOF
# Increase file descriptor limits for docfusion user
${DEPLOY_USER} soft nofile 65535
${DEPLOY_USER} hard nofile 65535
${DEPLOY_USER} soft nproc 65535
${DEPLOY_USER} hard nproc 65535
EOF

# ============================================================================
# 7. Configure Timezone
# ============================================================================

log_info "Setting timezone to ${TIMEZONE}..."
timedatectl set-timezone "${TIMEZONE}"

# ============================================================================
# 8. Configure Automatic Updates
# ============================================================================

log_info "Configuring automatic security updates..."

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# ============================================================================
# 9. SSH Hardening
# ============================================================================

log_info "Hardening SSH configuration..."

# Backup original
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Apply hardening settings
cat > /etc/ssh/sshd_config.d/99-hardening.conf << 'EOF'
# Disable root login
PermitRootLogin no

# Disable password authentication
PasswordAuthentication no
PubkeyAuthentication yes

# Limit authentication attempts
MaxAuthTries 3

# Disable empty passwords
PermitEmptyPasswords no

# Disable X11 forwarding
X11Forwarding no

# Use only secure ciphers
Ciphers aes256-gcm@openssh.com,chacha20-poly1305@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# Connection timeout
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Restart SSH
systemctl restart sshd

log_warn "SSH hardened. Ensure you have SSH key access before logging out!"

# ============================================================================
# 10. Install Node.js
# ============================================================================

log_info "Installing Node.js 20..."

# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for process management
npm install -g pm2

# ============================================================================
# 11. Install Python and UV
# ============================================================================

log_info "Installing Python 3.12 and UV..."

apt-get install -y python3.12 python3.12-venv python3-pip

# Install UV package manager
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add UV to PATH for all users
ln -sf /root/.local/bin/uv /usr/local/bin/uv
ln -sf /root/.local/bin/uvx /usr/local/bin/uvx

# ============================================================================
# 12. Create Application Directories
# ============================================================================

log_info "Creating application directories..."

mkdir -p /opt/docfusion/{app,logs,data,backups}
mkdir -p /var/log/docfusion

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /opt/docfusion
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /var/log/docfusion

# ============================================================================
# Summary
# ============================================================================

log_info "============================================"
log_info "VPS Base Configuration Complete!"
log_info "============================================"
log_info ""
log_info "User created: ${DEPLOY_USER}"
log_info "Firewall: UFW enabled (ports 22, 80, 443)"
log_info "Fail2Ban: Enabled"
log_info "Swap: ${SWAP_SIZE}"
log_info "Timezone: ${TIMEZONE}"
log_info "Node.js: $(node --version)"
log_info "Python: $(python3 --version)"
log_info ""
log_info "Next steps:"
log_info "1. SSH as ${DEPLOY_USER} and verify access"
log_info "2. Run: 02-install-postgresql.sh"
log_info "3. Run: 03-install-nginx.sh"
log_info ""
log_warn "IMPORTANT: Verify SSH key access before logging out!"
# Dokploy Security Configuration Guide

**Target**: Harden Dokploy server for GDPR-compliant production deployment
**Services**: PostgreSQL, Qdrant, MinIO, Redis, Next.js app
**Location**: Germany (Hetzner/EU)
**Compliance**: GDPR, ISO 27001 principles

---

## 📋 Overview

### Architecture

```
                    Internet
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Traefik (Port 80/443) - Reverse Proxy                 │
│  - SSL/TLS termination (Let's Encrypt)                 │
│  - Automatic HTTPS                                      │
│  - Security headers                                     │
│  - Rate limiting                                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                    Dokploy Network                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Qdrant    │  │    MinIO     │  │
│  │  :5432       │  │    :6333     │  │    :9000     │  │
│  │  (NO Traefik)│  │  (NO Traefik)│  │  (NO Traefik)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │    Redis     │  │  Next.js     │                     │
│  │  :6379       │  │    :3000     │                     │
│  │  (NO Traefik)│  │  (Traefik)✅  │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    Internal Only         Public (HTTPS)
```

### Security Layers

1. **Network Layer**: Firewall, VPN
2. **Application Layer**: Dokploy access control
3. **Service Layer**: Database authentication
4. **Data Layer**: Encryption at rest
5. **Monitoring Layer**: Logs and alerts

---

## 1️⃣ Server Hardening (Operating System)

### 1.1 Initial Server Setup

**Prerequisites**:
- Ubuntu 22.04 LTS or 24.04 LTS
- Root access or sudo user
- At least 4GB RAM, 2 CPU cores
- 80GB+ SSD storage

### 1.2 System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Enable automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Configure automatic updates
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

**Add to config**:
```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
```

### 1.3 Secure SSH Configuration

```bash
# Backup original config
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

**Critical settings**:
```ssh
# Disable root login
PermitRootLogin no

# Disable password authentication (key-only)
PasswordAuthentication no
PubkeyAuthentication yes

# Disable empty passwords
PermitEmptyPasswords no

# Limit login attempts
MaxAuthTries 3
LoginGraceTime 30

# Restrict protocols
Protocol 2

# Change default port (optional but recommended)
Port 22222

# Limit users
AllowUsers your-username dokploy

# Disable X11 forwarding
X11Forwarding no
```

```bash
# Restart SSH
sudo systemctl restart sshd

# Setup SSH key (if not already)
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
```

### 1.4 Configure Firewall (UFW)

```bash
# Install UFW
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (custom port if changed)
sudo ufw allow 22222/tcp comment 'SSH'

# Allow Dokploy web interface
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow Dokploy internal communication
sudo ufw allow from 127.0.0.1 to any port 3000 comment 'Next.js'
sudo ufw allow from 127.0.0.1 to any port 5432 comment 'PostgreSQL'
sudo ufw allow from 127.0.0.1 to any port 6333 comment 'Qdrant'
sudo ufw allow from 127.0.0.1 to any port 6379 comment 'Redis'
sudo ufw allow from 127.0.0.1 to any port 9000 comment 'MinIO'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

**Expected output**:
```
Status: active

To                         Action      From
--                         ------      ----
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
22222/tcp                  ALLOW       Anywhere
3000                       ALLOW       127.0.0.1
5432                       ALLOW       127.0.0.1
6333                       ALLOW       127.0.0.1
6379                       ALLOW       127.0.0.1
9000                       ALLOW       127.0.0.1
```

### 1.5 Fail2Ban for SSH Protection

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit configuration
sudo nano /etc/fail2ban/jail.local
```

**Add to config**:
```ini
[sshd]
enabled = true
port = 22222
maxretry = 3
bantime = 3600
findtime = 600
logpath = /var/log/auth.log

[traefik-auth]
enabled = true
maxretry = 5
bantime = 3600
logpath = /var/log/traefik/access.log
```

```bash
# Restart Fail2Ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# Check status
sudo fail2ban-client status sshd
```

### 1.6 Disable Unused Services

```bash
# List all services
sudo systemctl list-unit-files --type=service

# Disable unused services
sudo systemctl disable apport
sudo systemctl disable bluetooth
sudo systemctl disable cups
sudo systemctl disable snapd

# Stop them now
sudo systemctl stop apport
sudo systemctl stop bluetooth
sudo systemctl stop cups
```

---

## 2️⃣ Dokploy Security Configuration

### 2.1 Install Dokploy Securely

```bash
# Clone Dokploy
git clone https://github.com/Dokploy/dokploy.git
cd dokploy

# Install with Docker
./install.sh

# Or using Docker Compose
docker-compose up -d
```

### 2.2 Secure Dokploy Access with Traefik

#### Complete Docker Compose with Traefik

Dokploy uses Traefik as its reverse proxy. Configure via `docker-compose.yml`:

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: always
    ports:
      - "80:80"      # HTTP
      - "443:443"    # HTTPS
      - "127.0.0.1:8080:8080"  # Dashboard (localhost only)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/acme.json:/acme.json:rw
    networks:
      - dokploy_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.your-domain.com`)"
      - "traefik.http.routers.traefik.tls=true"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.middlewares=traefik-auth"
      - "traefik.http.middlewares.traefik-auth.basicauth.users=${TRAEFIK_AUTH}"

  dokploy:
    image: dokploy/dokploy:latest
    container_name: dokploy
    restart: always
    environment:
      - ADMIN_USER=admin
      - ADMIN_PASSWORD=${DOKPLOY_ADMIN_PASSWORD}
      - JWT_SECRET=${DOKPLOY_JWT_SECRET}
      - DATABASE_URL=postgres://dokploy:${POSTGRES_PASSWORD}@postgres:5432/dokploy
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - dokploy_data:/app/data
      - /var/lib/dokploy:/var/lib/dokploy
    networks:
      - dokploy_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dokploy.rule=Host(`your-domain.com`) || Host(`www.your-domain.com`)"
      - "traefik.http.routers.dokploy.tls=true"
      - "traefik.http.routers.dokploy.tls.certresolver=letsencrypt"
      - "traefik.http.routers.dokploy.entrypoints=websecure"
      - "traefik.http.services.dokploy.loadbalancer.server.port=3000"
      # Security headers
      - "traefik.http.middlewares.dokploy-headers.headers.customresponseheaders.Strict-Transport-Security=max-age=31536000; includeSubDomains"
      - "traefik.http.middlewares.dokploy-headers.headers.customresponseheaders.X-Frame-Options=SAMEORIGIN"
      - "traefik.http.middlewares.dokploy-headers.headers.customresponseheaders.X-Content-Type-Options=nosniff"
      - "traefik.http.routers.dokploy.middlewares=dokploy-headers,dokploy-ratelimit"
      # Rate limiting
      - "traefik.http.middlewares.dokploy-ratelimit.ratelimit.average=100"
      - "traefik.http.middlewares.dokploy-ratelimit.ratelimit.burst=50"
      - "traefik.http.middlewares.dokploy-ratelimit.ratelimit.period=1m"

  postgres:
    image: postgres:15-alpine
    container_name: dokploy_postgres
    restart: always
    environment:
      - POSTGRES_USER=dokploy
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=dokploy
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - dokploy_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dokploy -d dokploy"]
      interval: 30s
      timeout: 10s
      retries: 3
    # NO labels = internal only, no public access

volumes:
  dokploy_data:
  postgres_data:

networks:
  dokploy_network:
    driver: bridge
    internal: false  # Can access external for Let's Encrypt
```

### 2.3 Generate Secure Credentials

```bash
# Generate strong passwords
openssl rand -base64 32  # Use for POSTGRES_PASSWORD
openssl rand -base64 32  # Use for ADMIN_PASSWORD
openssl rand -base64 64  # Use for JWT_SECRET

# Generate bcrypt hash for admin password
python3 -c "import bcrypt; print(bcrypt.hashpw(b'YOUR_PASSWORD', bcrypt.gensalt()).decode())"
```

### 2.4 Configure Traefik

Create `traefik/traefik.yml`:

```yaml
# traefik/traefik.yml

global:
  checkNewVersion: true
  sendAnonymousUsage: false

# Log configuration
log:
  level: INFO
  filePath: /var/log/traefik/traefik.log
  format: json

# Access log
accessLog:
  filePath: /var/log/traefik/access.log
  format: json
  fields:
    headers:
      defaultMode: keep
      names:
        User-Agent: keep
        Authorization: drop  # Don't log auth tokens!
        Content-Type: keep

# Entry points
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt
        domains:
          - main: your-domain.com
            sans:
              - www.your-domain.com
      middlewares:
        - security-headers

# Traefik dashboard (localhost only)
api:
  dashboard: true
  insecure: false

# Certificate resolution
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /acme.json
      httpChallenge:
        entryPoint: web

# Docker provider
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false  # Require explicit traefik.enable=true
    swarmMode: false
    network: dokploy_network

# Enable ping
ping:
  entryPoint: websecure
```

### 2.5 Setup Traefik SSL/TLS

```bash
# Create acme.json file for Let's Encrypt certificates
mkdir -p traefik
touch traefik/acme.json
chmod 600 traefik/acme.json

# Initialize with empty JSON
echo '{}' > traefik/acme.json

# Generate Basic Auth password for Traefik dashboard
htpasswd -nb admin your_secure_password_here
# Output: admin:$apr1$abcdef...

# Or use openssl
openssl passwd -apr1 your_secure_password_here

# Add to .env file
echo "TRAEFIK_AUTH=admin:\$apr1\$abcdef..." >> .env

# Create logs directory
mkdir -p traefik/logs
chmod 700 traefik/logs
```

**Important**: Traefik will automatically obtain and renew SSL certificates via Let's Encrypt. No manual certificate management needed!

**To test SSL configuration**:
```bash
# Start services
docker-compose up -d

# Check Traefik logs
docker logs -f traefik

# Verify certificates were obtained
docker exec traefik cat /acme.json | jq .

# Test HTTPS
curl -I https://your-domain.com
```

---

## 3️⃣ PostgreSQL Security

### 3.1 Deploy Secure PostgreSQL

**Dokploy Compose Configuration**:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: projectnexus_postgres
    restart: always
    ports:
      - "127.0.0.1:5432:5432"  # Bind to localhost only
    environment:
      - POSTGRES_USER=nexary_user
      - POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_NOW
      - POSTGRES_DB=projectnexus
      - POSTGRES_INITDB_ARGS=--encoding=UTF8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nexary_user -d projectnexus"]
      interval: 30s
      timeout: 10s
      retries: 3
    command: >
      postgres
      -c config_file=/etc/postgresql/postgresql.conf
      -c hba_file=/etc/postgresql/pg_hba.conf

volumes:
  postgres_data:

networks:
  app_network:
    driver: bridge
    internal: true  # Isolated from external network
```

### 3.2 PostgreSQL Configuration

Create `postgresql.conf`:

```ini
# Connection settings
listen_addresses = '*'  # Controlled by pg_hba.conf
port = 5432
max_connections = 100

# Memory settings (adjust based on server RAM)
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 16MB

# Security
ssl = on
ssl_cert_file = '/var/lib/postgresql/server.crt'
ssl_key_file = '/var/lib/postgresql/server.key'
ssl_ca_file = '/var/lib/postgresql/root.crt'

# Logging
log_connections = on
log_disconnections = on
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 0

# Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1

# Data retention
autovacuum = on
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05
```

### 3.3 Host-Based Authentication (pg_hba.conf)

Create `pg_hba.conf`:

```ini
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections (from same container)
local   all             postgres                                peer
local   all             all                                     peer

# Internal connections (from other containers)
host    projectnexus    nexary_user      172.16.0.0/12          scram-sha-256
host    projectnexus    nexary_user      192.168.0.0/16         scram-sha-256

# Admin connection (from localhost with password)
host    all             nexary_admin      127.0.0.1/32           scram-sha-256

# Reject everything else
host    all             all              0.0.0.0/0              reject
```

### 3.4 User Permissions

```sql
-- Create admin user (for maintenance)
CREATE USER nexary_admin WITH SUPERUSER CREATEDB CREATEROLE
  LOGIN PASSWORD 'STRONG_ADMIN_PASSWORD';

-- Create application user (for app - limited permissions)
CREATE USER nexary_user WITH NOCREATEDB NOCREATEROLE NOINHERIT
  LOGIN PASSWORD 'STRONG_APP_PASSWORD';

-- Create database
CREATE DATABASE projectnexus OWNER nexary_admin;

-- Grant permissions
\c projectnexus
GRANT ALL PRIVILEGES ON DATABASE projectnexus TO nexary_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO nexary_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nexary_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nexary_user;

-- Create read-only user (for backups/analytics)
CREATE USER nexary_readonly WITH NOCREATEDB NOCREATEROLE NOINHERIT
  LOGIN PASSWORD 'STRONG_READONLY_PASSWORD';

GRANT CONNECT ON DATABASE projectnexus TO nexary_readonly;
GRANT USAGE ON SCHEMA public TO nexary_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nexary_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nexary_readonly;
```

### 3.5 Enable Encryption at Rest

PostgreSQL data should be encrypted. Two approaches:

**Option 1: Filesystem Encryption (Recommended)**

```bash
# Install cryptsetup
sudo apt install -y cryptsetup

# Create encrypted volume
sudo cryptsetup -y -v luksFormat /dev/sdb1
sudo cryptsetup open /dev/sdb1 encrypted_postgres

# Create filesystem
sudo mkfs.ext4 /dev/mapper/encrypted_postgres

# Mount
sudo mkdir -p /mnt/postgres_data
sudo mount /dev/mapper/encrypted_postgres /mnt/postgres_data
sudo chown -R 999:999 /mnt/postgres_data

# Update docker-compose to use encrypted volume
volumes:
  - /mnt/postgres_data:/var/lib/postgresql/data
```

**Option 2: Application-Level Encryption**

Encrypt sensitive columns before storing:

```typescript
// lib/crypto.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.POSTGRES_ENCRYPTION_KEY!; // 32 bytes
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

### 3.6 Backup Strategy

```bash
#!/bin/bash
# backup-postgres.sh

BACKUP_DIR="/mnt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/projectnexus_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup (docker exec)
docker exec projectnexus_postgres pg_dump \
  -U nexary_admin \
  -d projectnexus \
  --no-owner \
  --no-acl | gzip > $BACKUP_FILE

# Encrypt backup
openssl enc -aes-256-cbc -salt -in $BACKUP_FILE -out $BACKUP_FILE.enc -k $BACKUP_ENCRYPTION_KEY
rm $BACKUP_FILE

# Upload to S3/MinIO (optional)
# aws s3 cp $BACKUP_FILE.enc s3://backups/postgres/

# Keep last 30 days
find $BACKUP_DIR -name "*.enc" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.enc"
```

**Crontab** (daily backups at 2 AM):
```
0 2 * * * /path/to/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1
```

---

## 4️⃣ Qdrant Security

### 4.1 Deploy Secure Qdrant

**Dokploy Compose Configuration**:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:v1.7.4
    container_name: projectnexus_qdrant
    restart: always
    ports:
      - "127.0.0.1:6333:6333"  # HTTP API - localhost only
      - "127.0.0.1:6334:6334"  # gRPC API - localhost only
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__SERVICE__HTTP_PORT=6333
      # Enable API key authentication
      - QDRANT__SERVICE__API_KEY=YOUR_RANDOM_QDRANT_API_KEY_HERE
      # Enable TLS (if available in Qdrant version)
      - QDRANT__SERVICE__TLS_CERT=/certs/server.crt
      - Qdrant__SERVICE__TLS_KEY=/certs/server.key
      # Storage settings
      - QDRANT__STORAGE__STORAGE_PATH=/qdrant/storage
      # Performance settings
      - QDRANT__SERVICE__MAX_REQUEST_SIZE_MB=32
      - QDRANT__SERVICE__MAX_OPTIMIZATION_THREADS=2
    volumes:
      - qdrant_data:/qdrant/storage
      - ./qdrant/certs:/certs:ro
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M

volumes:
  qdrant_data:

networks:
  app_network:
    driver: bridge
    internal: true
```

### 4.2 Enable API Key Authentication

```typescript
// lib/rag/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY!,  // Required!
});

export default qdrantClient;
```

**Generate API Key**:
```bash
openssl rand -base64 32
```

**Add to `.env`**:
```bash
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=your-generated-api-key-here
```

### 4.3 Collection-Level Security

```typescript
// Create collections with access control
import qdrantClient from '@/lib/rag/qdrant';

export async function createSecureCollection(collectionName: string, userId: string) {
  await qdrantClient.createCollection(collectionName, {
    vectors: {
      size: 1536,  // OpenAI embedding size
      distance: 'Cosine',
    },
    optimizers_config: {
      default_segment_number: 2,
    },
    replication_factor: 1,
    // Enable indexing for faster queries
    hnsw_config: {
      m: 16,
      ef_construct: 100,
    },
  });

  // Store metadata about collection ownership
  await qdrantClient.createCollection(`${collectionName}_meta`, {
    vectors: {
      size: 1,  // Dummy vectors for metadata
      distance: 'Cosine',
    },
  });

  await qdrantClient.upsert(`${collectionName}_meta`, {
    points: [
      {
        id: 1,
        vector: [0],
        payload: {
          user_id: userId,
          created_at: new Date().toISOString(),
          access_count: 0,
        },
      },
    ],
  });
}
```

### 4.4 Query with Access Control

```typescript
// Query with user isolation
export async function searchWithAccessControl(
  collectionName: string,
  userId: string,
  queryVector: number[],
  limit: number = 10
) {
  // Verify user owns this collection
  const meta = await qdrantClient.retrieve(`${collectionName}_meta`, {
    ids: [1],
  });

  if (meta[0]?.payload?.user_id !== userId) {
    throw new Error('Access denied: Collection not owned by user');
  }

  // Perform search
  const results = await qdrantClient.search(collectionName, {
    vector: queryVector,
    limit: limit,
    score_threshold: 0.7,
    // Filter by user_id in payload (multi-user collections)
    filter: {
      must: [
        {
          key: 'user_id',
          match: { value: userId },
        },
      ],
    },
  });

  // Update access count
  await qdrantClient.overwrite(`${collectionName}_meta`, {
    points: [
      {
        id: 1,
        vector: [0],
        payload: {
          ...meta[0].payload,
          access_count: (meta[0].payload?.access_count || 0) + 1,
          last_accessed: new Date().toISOString(),
        },
      },
    ],
  });

  return results;
}
```

### 4.5 Qdrant Backup Strategy

```bash
#!/bin/bash
# backup-qdrant.sh

BACKUP_DIR="/mnt/backups/qdrant"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/qdrant_$TIMESTAMP.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup using Qdrant snapshot API
SNAPSHOT_NAME="backup_$TIMESTAMP"
curl -X POST "http://localhost:6333/collections/projectnexus/snapshots" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"snapshot_name\": \"$SNAPSHOT_NAME\"}"

# Copy snapshot from container
docker cp projectnexus_qdrant:/qdrant/storage/collections/projectnexus/snapshots/$SNAPSHOT_NAME \
  $BACKUP_FILE

# Encrypt backup
openssl enc -aes-256-cbc -salt -in $BACKUP_FILE -out $BACKUP_FILE.enc -k $BACKUP_ENCRYPTION_KEY
rm $BACKUP_FILE

# Keep last 7 days (Qdrant snapshots are larger)
find $BACKUP_DIR -name "*.enc" -mtime +7 -delete

echo "Qdrant backup completed: $BACKUP_FILE.enc"
```

---

## 5️⃣ Redis Security

### 5.1 Deploy Secure Redis

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: projectnexus_redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"  # Localhost only
    command: >
      redis-server
      --requirepass CHANGE_THIS_REDIS_PASSWORD_NOW
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
      --appendonly yes
      --appendfsync everysec
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
```

### 5.2 Configure Redis Connection

```typescript
// lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD!,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

export default redis;
```

---

## 6️⃣ Secrets Management

### 6.1 Environment Variables Best Practices

**❌ BAD** (committing to git):
```typescript
const apiKey = "sk-abc123...";
```

**✅ GOOD** (environment variables):
```typescript
const apiKey = process.env.OPENAI_API_KEY!;
```

### 6.2 Docker Secrets (Recommended)

Create secrets directory:
```bash
mkdir -p secrets
chmod 700 secrets
```

**Create secrets**:
```bash
# PostgreSQL password
echo "STRONG_POSTGRES_PASSWORD" > secrets/postgres_password
chmod 600 secrets/postgres_password

# Qdrant API key
openssl rand -base64 32 > secrets/qdrant_api_key
chmod 600 secrets/qdrant_api_key

# Redis password
openssl rand -base64 24 > secrets/redis_password
chmod 600 secrets/redis_password

# App secrets
echo "JWT_SECRET_HERE" > secrets/jwt_secret
chmod 600 secrets/jwt_secret
```

**Use in docker-compose**:
```yaml
services:
  postgres:
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
    secrets:
      - postgres_password

  qdrant:
    environment:
      - QDRANT__SERVICE__API_KEY_FILE=/run/secrets/qdrant_api_key
    secrets:
      - qdrant_api_key

secrets:
  postgres_password:
    file: ./secrets/postgres_password
  qdrant_api_key:
    file: ./secrets/qdrant_api_key
```

### 6.3 Environment Variables Template

Create `.env.example` (safe to commit):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
POSTGRES_PASSWORD=change_this_in_production

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=generate_with_openssl_rand

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=generate_strong_password

# AI Providers
OPENAI_API_KEY=sk-...
AZURE_OPENAI_API_KEY=...
MISTRAL_API_KEY=...

# App
NEXTAUTH_SECRET=generate_with_openssl_rand
NEXTAUTH_URL=https://your-domain.com

# Monitoring
SENTRY_DSN=https://...
LOG_LEVEL=info
```

**Create `.env` (DO NOT COMMIT)**:
```bash
cp .env.example .env
nano .env  # Fill in actual values
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"
```

---

## 7️⃣ Monitoring & Logging

### 7.1 Centralized Logging with Loki (Optional)

```yaml
services:
  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: always
    ports:
      - "127.0.0.1:3100:3100"
    volumes:
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    restart: always
    volumes:
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  loki_data:
```

### 7.2 Container Resource Monitoring

```yaml
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    restart: always
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    privileged: true
    networks:
      - monitoring
```

### 7.3 Setup Sentry for Error Tracking

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

---

## 8️⃣ Security Checklist

### Pre-Deployment Checklist

- [ ] SSH key-only authentication enabled
- [ ] Root login disabled
- [ ] Firewall configured (UFW)
- [ ] Fail2Ban installed and active
- [ ] SSL/TLS certificates installed
- [ ] PostgreSQL bound to localhost only
- [ ] Qdrant API key configured
- [ ] Redis password configured
- [ ] All secrets in environment variables or Docker secrets
- [ ] `.env` file in `.gitignore`
- [ ] Database backups automated
- [ ] Log rotation configured
- [ ] Monitoring/health checks enabled
- [ ] Traefik security headers configured
- [ ] Rate limiting configured via Traefik middlewares
- [ ] Container resource limits set
- [ ] Automatic security updates enabled

### Post-Deployment Checklist

- [ ] Test SSL/TLS configuration (https://www.ssllabs.com/ssltest/)
- [ ] Verify database encryption at rest
- [ ] Test backup restoration
- [ ] Verify access controls (try unauthorized access)
- [ ] Setup alerting for security events
- [ ] Document all passwords and keys (store securely)
- [ ] Create incident response plan
- [ ] Regular security audits (quarterly)

---

## 9️⃣ Maintenance Tasks

### Daily
- Check backup logs
- Monitor disk space
- Review error logs (Sentry)

### Weekly
- Review access logs
- Check for security updates
- Test backup restoration

### Monthly
- Rotate API keys (if desired)
- Review and revoke unused access
- Security audit of containers
- Performance tuning

### Quarterly
- Full security audit
- Penetration testing
- Disaster recovery drill
- Update documentation

---

## 🔟 Common Issues & Solutions

### Issue 1: Container can't connect to database

**Solution**:
```bash
# Check if database is running
docker ps | grep postgres

# Check network
docker network inspect app_network

# Check firewall
sudo ufw status
```

### Issue 2: SSL certificate errors

**Solution**:
```bash
# Check certificate status
docker exec traefik cat /acme.json | jq '.Cloudflare.Certificates[]'

# Check Traefik logs for certificate errors
docker logs traefik | grep -i certificate

# Restart Traefik to force renewal
docker restart traefik

# Verify certificates after restart
curl -I https://your-domain.com
```

### Issue 3: High memory usage

**Solution**:
```yaml
# Add resource limits to docker-compose
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
```

### Issue 4: Backup failed

**Solution**:
```bash
# Check disk space
df -h

# Check backup logs
cat /var/log/postgres-backup.log

# Test backup manually
./backup-postgres.sh
```

---

## 📞 Support & Resources

- **Dokploy Documentation**: https://dokploy.com/docs
- **Traefik Documentation**: https://doc.traefik.io/traefik/
- **PostgreSQL Security**: https://www.postgresql.org/docs/current/security.html
- **Qdrant Documentation**: https://qdrant.tech/documentation/
- **SSL Labs**: https://www.ssllabs.com/ssltest/

---

**Last Updated**: January 2026
**Version**: 1.0
**Maintainer**: DevOps Team

---

## 🎯 Quick Start Commands

```bash
# Clone this repo
git clone https://github.com/your-repo/dokploy-security.git
cd dokploy-security

# Copy example configs
cp .env.example .env

# Prepare Traefik
mkdir -p traefik/logs
touch traefik/acme.json
chmod 600 traefik/acme.json
echo '{}' > traefik/acme.json

# Generate secrets
./scripts/generate-secrets.sh

# Start services
docker-compose up -d

# Check health
docker-compose ps

# Check Traefik logs for certificates
docker logs -f traefik

# Test HTTPS
curl -I https://your-domain.com
```

**Remember**:
- Services without `traefik.enable=true` labels are **internal only**
- PostgreSQL, Qdrant, Redis should have NO Traefik labels
- Only your Next.js app needs Traefik labels for public access
- Security is an ongoing process, not a one-time setup. Regular audits and updates are essential!

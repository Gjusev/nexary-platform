# Dokploy + Traefik Security Configuration

**Target**: Secure Dokploy deployment with Traefik reverse proxy
**Services**: PostgreSQL, Qdrant, MinIO, Redis, Next.js
**Location**: Germany (Hetzner/EU)
**Compliance**: GDPR, ISO 27001 principles

---

## 📋 Architecture with Traefik

```
Internet
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│  Traefik (Port 80/443)                                  │
│  - SSL/TLS termination                                  │
│  - Automatic HTTPS (Let's Encrypt)                      │
│  - Load balancing                                       │
│  - Rate limiting                                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  Dokploy Network (Internal)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Qdrant    │  │    MinIO     │  │
│  │  :5432       │  │    :6333     │  │    :9000     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │    Redis     │  │  Next.js     │                     │
│  │  :6379       │  │    :3000     │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

---

## 1️⃣ Traefik Security Configuration

### 1.1 Dokploy docker-compose.yml con Traefik

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
      - "8080:8080"  # Dashboard (localhost only)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/acme.json:/acme.json:rw
      - ./traefik/logs:/var/log/traefik
    networks:
      - dokploy_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`traefik.your-domain.com`)"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.api.service=api@internal"
      - "traefik.http.routers.api.middlewares=traefik-auth"
      - "traefik.http.middlewares.traefik-auth.basicauth.users=${TRAEFIK_AUTH}"
    environment:
      - "TZ=Europe/Berlin"

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
      -traefik.http.routers.dokploy.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.dokploy.tls=true"
      - "traefik.http.routers.dokploy.tls.certresolver=letsencrypt"
      - "traefik.http.routers.dokploy.entrypoints=https"
      - "traefik.http.services.dokploy.loadbalancer.server.port=3000"
      # Security headers
      - "traefik.http.middlewares.dokploy-headers.headers.accesscontrolallowmethods=GET,OPTIONS,PUT,POST,DELETE,PATCH"
      - "traefik.http.middlewares.dokploy-headers.headers.accesscontrolallowheaders=Authorization,Content-Type"
      - "traefik.http.middlewares.dokploy-headers.headers.accesscontrolmaxage=100"
      - "traefik.http.middlewares.dokploy-headers.headers.addvaryheader=true"
      - "traefik.http.middlewares.dokploy-headers.headers.framedeny=true"
      - "traefik.http.middlewares.dokploy-headers.headers.browserxssfilter=true"
      - "traefik.http.middlewares.dokploy-headers.headers.contentsecuritypolicy=default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      - "traefik.http.middlewares.dokploy-headers.headers.referrerpolicy=no-referrer-when-downgrade"
      - "traefik.http.middlewares.dokploy-headers.headers.customrequestheaders.X-Forwarded-Proto=https"
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
    # No labels = no public access (internal only)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dokploy -d dokploy"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  dokploy_network:
    driver: bridge
    internal: false  # Can access external for Let's Encrypt

volumes:
  dokploy_data:
  postgres_data:
```

### 1.2 Traefik Configuration (traefik.yml)

```yaml
# traefik/traefik.yml

# Global configuration
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
              - app.your-domain.com
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
      dnsChallenge:
        provider: cloudflare  # Or httpChallenge for HTTP validation
        delayBeforeCheck: 30
      httpChallenge:
        entryPoint: web
      tlsChallenge: true

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

### 1.3 Security Middleware Configuration

```yaml
# Add to your Traefik configuration or as Docker labels

# Security headers middleware
traefik.http.middlewares.security-headers.headers.customresponseheaders:
  X-Frame-Options: "SAMEORIGIN"
  X-Content-Type-Options: "nosniff"
  X-XSS-Protection: "1; mode=block"
  Referrer-Policy: "no-referrer-when-downgrade"
  Permissions-Policy: "geolocation=(), microphone=(), camera=()"
  Strict-Transport-Security: "max-age=31536000; includeSubDomains"

# Content Security Policy
traefik.http.middlewares.security-headers.headers.contentsecuritypolicy: |
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

# Rate limiting (global)
traefik.http.middlewares.global-ratelimit.ratelimit:
  average: 100
  burst: 50
  period: 1m

# IP whitelist (for admin areas)
traefik.http.middlewares.ipwhitelist.ipwhitelist:
  sourcerange:
    - "1.2.3.4/32"  # Your office IP
    - "5.6.7.8/32"  # Your home IP
```

---

## 2️⃣ Let's Encrypt SSL Setup

### 2.1 Prepare ACME JSON File

```bash
# Create acme.json with proper permissions
touch traefik/acme.json
chmod 600 traefik/acme.json

# Initialize with empty JSON if needed
echo '{}' > traefik/acme.json
```

### 2.2 HTTP Challenge (Simplest)

```yaml
# In traefik.yml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /acme.json
      httpChallenge:
        entryPoint: web
```

**Requirements**: Port 80 must be accessible from internet

### 2.3 DNS Challenge (Recommended for Wildcard)

```yaml
# In traefik.yml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /acme.json
      dnsChallenge:
        provider: cloudflare  # or digitalocean, gandi, etc.
        delayBeforeCheck: 30
        resolvers:
          - "1.1.1.1:53"
          - "8.8.8.8:53"
```

**Set environment variables**:
```bash
# Cloudflare
export CF_DNS_API_TOKEN=your-cloudflare-token

# DigitalOcean
export DO_AUTH_TOKEN=your-digitalocean-token

# Gandi
export GANDI_API_KEY=your-gandi-key
```

### 2.4 TLS Configuration (Optional Hardening)

```yaml
# In traefik.yml
entryPoints:
  websecure:
    address: ":443"
    http:
      tls:
        minVersion: VersionTLS12
        cipherSuites:
          - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
          - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
          - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
          - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
          - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
          - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
        certResolver: letsencrypt
```

---

## 3️⃣ Service Deployment with Traefik Labels

### 3.1 PostgreSQL (Internal Only - No Public Access)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: projectnexus_postgres
    restart: always
    ports:
      - "127.0.0.1:5432:5432"  # Localhost only, not exposed to Traefik
    environment:
      - POSTGRES_USER=nexary_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=projectnexus
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nexary_user -d projectnexus"]
      interval: 30s
      timeout: 10s
      retries: 3
    # NO Traefik labels = internal only
```

### 3.2 Qdrant (Internal Only)

```yaml
services:
  qdrant:
    image: qdrant/qdrant:v1.7.4
    container_name: projectnexus_qdrant
    restart: always
    ports:
      - "127.0.0.1:6333:6333"  # Localhost only
      - "127.0.0.1:6334:6334"  # gRPC
    environment:
      - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}
      - QDRANT__STORAGE__STORAGE_PATH=/qdrant/storage
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    # NO Traefik labels = internal only

networks:
  app_network:
    driver: bridge
    internal: false  # Can access external for API calls
```

### 3.3 Next.js App (Public with HTTPS)

```yaml
services:
  app:
    image: your-registry/projectnexus:latest
    container_name: projectnexus_app
    restart: always
    environment:
      - DATABASE_URL=postgresql://nexary_user:${POSTGRES_PASSWORD}@postgres:5432/projectnexus
      - QDRANT_URL=http://qdrant:6333
      - QDRANT_API_KEY=${QDRANT_API_KEY}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - NEXTAUTH_URL=https://app.your-domain.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    networks:
      - app_network
      - dokploy_network  # Connect to Traefik network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.your-domain.com`) || Host(`www.app.your-domain.com`)"
      - "traefik.http.routers.app.tls=true"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.services.app.loadbalancer.server.port=3000"
      - "traefik.http.routers.app.middlewares=app-headers,app-ratelimit,app-compress"
      # Security headers
      - "traefik.http.middlewares.app-headers.headers.customrequestheaders.X-Forwarded-Proto=https"
      - "traefik.http.middlewares.app-headers.headers.customresponseheaders.Strict-Transport-Security=max-age=31536000; includeSubDomains"
      - "traefik.http.middlewares.app-headers.headers.customresponseheaders.X-Frame-Options=SAMEORIGIN"
      - "traefik.http.middlewares.app-headers.headers.customresponseheaders.X-Content-Type-Options=nosniff"
      - "traefik.http.middlewares.app-headers.headers.referrerpolicy=no-referrer-when-downgrade"
      # Compression
      - "traefik.http.middlewares.app-compress.compress=true"
      # Rate limiting (per user IP)
      - "traefik.http.middlewares.app-ratelimit.ratelimit.average=50"
      - "traefik.http.middlewares.app-ratelimit.ratelimit.burst=100"
      - "traefik.http.middlewares.app-ratelimit.ratelimit.period=1m"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
```

### 3.4 MinIO (Internal - Access via App)

```yaml
services:
  minio:
    image: minio/minio:latest
    container_name: projectnexus_minio
    restart: always
    command: server /data --console-address ":9001"
    ports:
      - "127.0.0.1:9000:9000"  # API
      - "127.0.0.1:9001:9001"  # Console
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
      - MINIO_DEFAULT_BUCKETS=documents,avatars,temp
    volumes:
      - minio_data:/data
    networks:
      - app_network
    # NO Traefik labels - access via app proxy only
```

### 3.5 Redis (Internal Only)

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: projectnexus_redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 4️⃣ Traefik Dashboard Security

### 4.1 Basic Auth for Dashboard

```bash
# Generate password
htpasswd -nb admin secure_password_here
# Output: admin:$apr1$abcdef...

# Or use openssl
openssl passwd -apr1 secure_password_here
```

Add to `.env`:
```bash
TRAEFIK_AUTH=admin:$apr1$abcdef...
```

### 4.2 Dashboard Labels (in docker-compose)

```yaml
services:
  traefik:
    image: traefik:v2.10
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.your-domain.com`)"
      - "traefik.http.routers.traefik.tls=true"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.middlewares=traefik-auth,traefik-whitelist"
      - "traefik.http.middlewares.traefik-auth.basicauth.users=${TRAEFIK_AUTH}"
      # IP whitelist (optional)
      - "traefik.http.middlewares.traefik-whitelist.ipwhitelist.sourcerange=1.2.3.4/32,5.6.7.8/32"
```

### 4.3 Access Dashboard

```bash
# Via SSH tunnel (recommended)
ssh -L 8080:localhost:8080 user@your-server

# Access at:
http://localhost:8080/dashboard/

# Or via secure subdomain
https://traefik.your-domain.com
```

---

## 5️⃣ Monitoring & Logging with Traefik

### 5.1 Prometheus Metrics

```yaml
# In traefik.yml
metrics:
  prometheus:
    entryPoint: traefik
    addEntryPointsLabels: true
    addServicesLabels: true
    buckets:
      - "0.1"
      - "0.3"
      - "1.2"
      - "5.0"
```

Access metrics:
```bash
http://localhost:8080/metrics
```

### 5.2 Access Logs

```yaml
# In traefik.yml
accessLog:
  filePath: "/var/log/traefik/access.log"
  format: json
  fields:
    headers:
      defaultMode: keep
      names:
        User-Agent: keep
        Authorization: drop  # Don't log tokens!
        Content-Type: keep
    keeping:
      - StartUTC
      - Duration
      - RouterName
      - ServiceName
      - StatusCode
      - ClientAddr
    # Filters
  filters:
    statuscodes:
      - "400-499"
      - "500-599"
```

### 5.3 Log Rotation

Create `/etc/logrotate.d/traefik`:
```
/var/log/traefik/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 traefik traefik
    sharedscripts
    postrotate
        docker exec traefik kill -USR1 1
    endscript
}
```

---

## 6️⃣ Rate Limiting Strategies

### 6.1 Global Rate Limit

```yaml
# Global middleware in traefik.yml
http:
  middlewares:
    global-rate-limit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m
```

Apply to all routes:
```yaml
labels:
  - "traefik.http.routers.app.middlewares=global-rate-limit"
```

### 6.2 Per-Service Rate Limit

```yaml
# API endpoints - stricter
labels:
  - "traefik.http.middlewares.api-ratelimit.ratelimit.average=20"
  - "traefik.http.middlewares.api-ratelimit.ratelimit.burst=30"
  - "traefik.http.middlewares.api-ratelimit.ratelimit.period=1m"

# Chat endpoints - moderate
labels:
  - "traefik.http.middlewares.chat-ratelimit.ratelimit.average=10"
  - "traefik.http.middlewares.chat-ratelimit.ratelimit.burst=20"
  - "traefik.http.middlewares.chat-ratelimit.ratelimit.period=1m"

# Public pages - lenient
labels:
  - "traefik.http.middlewares.public-ratelimit.ratelimit.average=200"
  - "traefik.http.middlewares.public-ratelimit.ratelimit.burst=100"
  - "traefik.http.middlewares.public-ratelimit.ratelimit.period=1m"
```

### 6.3 Advanced Rate Limiting with Redis

For production, use Redis-based rate limiting:

```yaml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--experimental.localplugins.ratelimit.moduleName=github.com/traefik/traefik-ratelimit"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./plugins:/plugins-local
```

---

## 7️⃣ DDoS Protection

### 7.1 Traefik Configuration

```yaml
# In traefik.yml
entryPoints:
  websecure:
    address: ":443"
    http:
      middlewares:
        - security-headers
        - global-ratelimit

# Middlewares
http:
  middlewares:
    # Block common attack patterns
    block-bad-actors:
      ipStrategy:
        sources:
          - "10.0.0.0/8"  # Private networks
          - "172.16.0.0/12"
          - "192.168.0.0/16"
      # Custom plugin for blocking known bad IPs

    # Request size limits
    size-limit:
      buffering:
        maxRequestBodyBytes: 10485760  # 10MB
        memRequestBodyBytes: 1048576   # 1MB
        maxResponseBodyBytes: 10485760 # 10MB
        memResponseBodyBytes: 1048576  # 1MB
```

### 7.2 Cloudflare Integration (Recommended)

1. **Use Cloudflare as CDN**:
   - Enable "Orange Cloud" in Cloudflare DNS
   - Traefik sees Cloudflare IPs as X-Forwarded-For

2. **Configure Cloudflare**:
   ```
   - Security Level: Medium/High
   - Bot Fight Mode: On
   - Rate Limiting: Enable
   - Web Application Firewall (WAF): On
   ```

3. **Trust Cloudflare IPs in Traefik**:

```yaml
# In traefik.yml
entryPoints:
  websecure:
    address: ":443"
    proxyProtocol:
      trustedIPs:
        - "173.245.48.0/20"
        - "103.21.244.0/22"
        - "103.22.200.0/22"
        - "103.31.4.0/22"
        - "141.101.64.0/18"
        - "108.162.192.0/18"
        - "190.93.240.0/20"
        - "188.114.96.0/20"
        - "197.234.240.0/22"
        - "198.41.128.0/17"
        - "162.158.0.0/15"
        - "104.16.0.0/13"
        - "104.24.0.0/14"
        - "172.64.0.0/13"
        - "131.0.72.0/22"
```

---

## 8️⃣ Backup Strategy for Traefik

### 8.1 Backup ACME Certificates

```bash
#!/bin/bash
# backup-traefik.sh

BACKUP_DIR="/mnt/backups/traefik"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf $BACKUP_DIR/traefik_$TIMESTAMP.tar.gz \
  traefik/acme.json \
  traefik/traefik.yml

# Encrypt
openssl enc -aes-256-cbc -salt -in $BACKUP_DIR/traefik_$TIMESTAMP.tar.gz \
  -out $BACKUP_DIR/traefik_$TIMESTAMP.tar.gz.enc \
  -k $BACKUP_ENCRYPTION_KEY

rm $BACKUP_DIR/traefik_$TIMESTAMP.tar.gz

# Keep last 30 days
find $BACKUP_DIR -name "*.enc" -mtime +30 -delete

echo "Traefik backup completed"
```

### 8.2 Automated Backups

```bash
# Crontab
0 3 * * * /path/to/backup-traefik.sh >> /var/log/traefik-backup.log 2>&1
```

---

## 9️⃣ Security Checklist for Traefik

### Pre-Deployment

- [ ] Traefik dashboard secured with Basic Auth
- [ ] Dashboard accessible only via SSH tunnel or IP whitelist
- [ ] SSL/TLS certificates configured (Let's Encrypt)
- [ ] HTTP to HTTPS redirection enabled
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)
- [ ] Rate limiting enabled for all public routes
- [ ] Database services have NO Traefik labels (internal only)
- [ ] Qdrant, Redis, MinIO not exposed publicly
- [ ] ACME.json has 600 permissions
- [ ] Access logs enabled (for security monitoring)
- [ ] Cloudflare integration enabled (optional but recommended)
- [ ] IP whitelist configured for admin areas

### Post-Deployment

- [ ] Test SSL configuration: `https://www.ssllabs.com/ssltest/`
- [ ] Verify HTTP → HTTPS redirect
- [ ] Test security headers: `curl -I https://your-domain.com`
- [ ] Verify rate limiting works (use tools like Apache Bench)
- [ ] Check Traefik dashboard is secured
- [ ] Test backup restoration
- [ ] Monitor logs for suspicious activity
- [ ] Setup alerts for high error rates

---

## 🔧 Troubleshooting

### Issue 1: ACME Certificate Errors

```bash
# Check acme.json
cat traefik/acme.json | jq .

# Check permissions
ls -la traefik/acme.json
# Should be: -rw------- 1 user user

# Renew manually
docker stop traefik
rm traefik/acme.json
docker start traefik
```

### Issue 2: High CPU Usage

```yaml
# Add resource limits to Traefik
services:
  traefik:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Issue 3: Rate Limiting Not Working

```bash
# Check if middleware is applied
curl -H "Host: app.your-domain.com" http://localhost:8080/api/http/routers

# Verify middleware order (must be after HTTPS redirect)
labels:
  - "traefik.http.routers.app.middlewares=app-headers,app-ratelimit"
```

### Issue 4: Services Can't Communicate

```bash
# Check network connectivity
docker network inspect dokploy_network
docker network inspect app_network

# Test from container
docker exec projectnexus_app ping postgres
docker exec projectnexus_app curl http://qdrant:6333/health
```

---

## 📚 Additional Resources

- **Traefik Documentation**: https://doc.traefik.io/traefik/
- **Traefik Middleware**: https://doc.traefik.io/traefik/middlewares/http/
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **Cloudflare + Traefik**: https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/

---

**Last Updated**: January 2026
**Version**: 2.0 (Traefik-specific)

---

## 🚀 Quick Start

```bash
# 1. Create directories
mkdir -p traefik logs backups

# 2. Create acme.json
touch traefik/acme.json
chmod 600 traefik/acme.json

# 3. Generate passwords
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 32  # For QDRANT_API_KEY
openssl rand -base64 32  # For REDIS_PASSWORD
htpasswd -nb admin your-password  # For TRAEFIK_AUTH

# 4. Update .env file
nano .env

# 5. Start services
docker-compose up -d

# 6. Check logs
docker-compose logs -f traefik

# 7. Verify certificates
docker exec traefik cat /acme.json | jq .
```

**Remember**: With Traefik, you only expose services that have `traefik.enable=true` labels. PostgreSQL, Qdrant, Redis should have NO labels to remain internal-only!

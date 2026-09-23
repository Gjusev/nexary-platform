# Backup and Recovery Runbook

## Overview

This runbook covers backup strategies, disaster recovery procedures, and data restoration for the Nexary platform.

## Backup Architecture

### What Gets Backed Up

| Component | Backup Method | Frequency | Retention | Location |
|-----------|--------------|-----------|-----------|----------|
| PostgreSQL | Full dump | Daily (2 AM UTC) | 30 days | Cross-region |
| PostgreSQL | Incremental (WAL) | Continuous | 24 hours | Local + Remote |
| Qdrant | Snapshot | Every 6 hours | 7 days | Object storage |
| Redis | RDB file | Hourly | 7 days | Object storage |
| MinIO | Objects | Continuous | 90 days | Cross-region |
| Code/Config | Git push | Per commit | Forever | GitHub |

### Backup Storage

**Primary Region**: eu-central-1 (Frankfurt)
**Backup Region**: eu-west-1 (Ireland)
**Off-site**: AWS Glacier (long-term archival)

## Automated Backups

### PostgreSQL Backups

#### Full Database Backup

```bash
#!/bin/bash
# scripts/backup-postgres.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Run backup
pg_dump $DATABASE_URL \
  --format=custom \
  --file=$BACKUP_DIR/nexary_$DATE.dump \
  --verbose

# Upload to S3/MinIO
aws s3 cp $BACKUP_DIR/nexary_$DATE.dump \
  s3://nexary-backups/postgres/nexary_$DATE.dump

# Cleanup old backups
find $BACKUP_DIR -name "nexary_*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: nexary_$DATE.dump"
```

#### Continuous Archiving (WAL)

```bash
# Enable in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://nexary-backups/postgres/wal/%f'
max_wal_senders = 3
wal_keep_size = 1GB
```

#### Restore Procedure

```bash
# Stop application
kubectl scale deployment nexary-api --replicas=0 -n production

# Restore from backup
pg_restore $DATABASE_URL \
  --format=custom \
  --clean \
  --if-exists \
  --jobs=4 \
  /backups/postgres/nexary_20250101_020000.dump

# Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Restart application
kubectl scale deployment nexary-api --replicas=3 -n production

# Verify application health
curl https://api.nexary.ai/health
```

### Qdrant Backups

#### Create Snapshot

```bash
#!/bin/bash
# scripts/backup-qdrant.sh

DATE=$(date +%Y%m%d_%H%M%S)
QDRANT_URL="http://qdrant:6333"

# Create snapshot for all collections
curl -X PUT "$QDRANT_URL/collections/_all/snapshots" \
  -H "Content-Type: application/json"

# Wait for snapshot creation
sleep 60

# Download snapshots
COLLECTIONS=$(curl -s "$QDRANT_URL/collections" | jq -r '.result.collections[].info.name')

for collection in $COLLECTIONS; do
  SNAPSHOT_NAME=$(curl -s "$QDRANT_URL/collections/$collection/snapshots" | jq -r '.result[0].name')

  curl -O "$QDRANT_URL/collections/$collection/snapshots/$SNAPSHOT_NAME"

  # Upload to S3
  aws s3 cp $SNAPSHOT_NAME \
    s3://nexary-backups/qdrant/$collection/$SNAPSHOT_NAME

  rm $SNAPSHOT_NAME
done
```

#### Restore Procedure

```bash
QDRANT_URL="http://qdrant:6333"
COLLECTION_ID="rag-package-uuid"

# Download snapshot from S3
aws s3 cp s3://nexary-backups/qdrant/$COLLECTION_ID/snapshot.snap .

# Restore collection
curl -X PUT "$QDRANT_URL/collections/$COLLECTION_ID/snapshots/recover" \
  -H "Content-Type: multipart/form-data" \
  --data-binary "@snapshot.snap"

# Verify restoration
curl "$QDRANT_URL/collections/$COLLECTION_ID"
```

### Redis Backups

#### Trigger Backup

```bash
# Trigger immediate backup
redis-cli -u $REDIS_URL BGSAVE

# Check backup status
redis-cli -u $REDIS_URL LASTSAVE

# Backup file location (in Redis container)
# /data/dump.rdb
```

#### Restore Procedure

```bash
# Stop Redis
kubectl scale statefulset redis --replicas=0 -n production

# Copy backup to persistent volume
kubectl cp /backups/redis/dump.rdb \
  redis-0:/data/dump.rdb \
  -n production

# Start Redis
kubectl scale statefulset redis --replicas=1 -n production

# Verify
redis-cli -u $REDIS_URL PING
```

### MinIO Backups

#### Version Control

```bash
# Enable versioning on buckets
mc version enable nexary-documents

# List object versions
mc ls --versions nexary-documents

# Restore previous version
mc cp --versions nexary-documents/document.pdf \
  --attr "VersionId=previous_version_id"
```

#### Replication

```bash
# Setup bucket replication
mc admin bucket remote add nexary-documents \
  --region eu-west-1 \
  --access-key $REMOTE_ACCESS_KEY \
  --secret-key $REMOTE_SECRET_KEY \
  https://minio-backup.nexary.ai
```

## Disaster Recovery

### Recovery Objectives

| Metric | Target | Actual |
|--------|--------|--------|
| **RPO** (Recovery Point Objective) | 1 hour | 15 minutes (WAL) |
| **RTO** (Recovery Time Objective) | 4 hours | 2 hours (tested) |

### Recovery Scenarios

#### Scenario 1: Database Corruption

**Detection**:
```bash
# Check database integrity
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database_conflicts"

# Check for corrupted blocks
psql $DATABASE_URL -c "SELECT * FROM pg_database;"

# Error messages in logs
kubectl logs -n production -l app=postgres | grep "corrupt"
```

**Recovery Steps**:
```bash
# 1. Stop application
kubectl scale deployment nexary-api --replicas=0 -n production

# 2. Identify last good backup
aws s3 ls s3://nexary-backups/postgres/ | sort -r | head -5

# 3. Restore backup
pg_restore $DATABASE_URL \
  --format=custom \
  --clean \
  --if-exists \
  /backups/postgres/nexary_good_backup.dump

# 4. Point-in-time recovery (if needed)
# Create recovery.conf
echo "restore_command = 'aws s3 cp s3://nexary-backups/postgres/wal/%f %p'" > /var/lib/postgresql/recovery.conf
echo "recovery_target_time = '2025-01-01 12:00:00'" >> /var/lib/postgresql/recovery.conf

# 5. Restart database
kubectl rollout restart statefulset postgres -n production

# 6. Verify integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM chat_conversations;"

# 7. Restart application
kubectl scale deployment nexary-api --replicas=3 -n production
```

#### Scenario 2: Complete Data Center Outage

**Recovery Steps**:
```bash
# 1. Activate backup region
kubectl config use-context nexary-backup-region

# 2. Restore from cross-region backups
# PostgreSQL
aws s3 cp s3://nexary-backups-cross-region/postgres/latest.dump \
  /tmp/nexary.dump
pg_restore $BACKUP_DATABASE_URL --format=custom --clean /tmp/nexary.dump

# Qdrant
aws s3 sync s3://nexary-backups-cross-region/qdrant/ \
  /data/qdrant/snapshots/

# MinIO (already replicated, just switch DNS)

# 3. Update DNS
# Point api.nexary.ai to backup region IPs

# 4. Verify
curl https://api.nexary.ai/health

# 5. Monitor for issues
kubectl logs -n production -l app=nexary-api -f
```

#### Scenario 3: Accidental Data Deletion

**Recovery Steps**:
```bash
# 1. Identify what was deleted
# Check audit logs
psql $DATABASE_URL -c "SELECT * FROM audit_logs WHERE action LIKE '%DELETE%' ORDER BY created_at DESC LIMIT 20"

# 2. Stop application (prevent new data)
kubectl scale deployment nexary-api --replicas=0 -n production

# 3. Restore specific tables
pg_restore $DATABASE_URL \
  --format=custom \
  --table=chat_messages \
  --data-only \
  /backups/postgres/nexary_before_delete.dump

# 4. Or restore entire database to point in time
pg_restore $DATABASE_URL \
  --format=custom \
  --clean \
  --if-exists \
  /backups/postgres/nexary_before_delete.dump

# 5. Restart application
kubectl scale deployment nexary-api --replicas=3 -n production
```

#### Scenario 4: Ransomware Attack

**Immediate Actions**:
```bash
# 1. ISOLATE SYSTEMS
kubectl scale deployment --all --replicas=0 -n production

# 2. PRESERVE EVIDENCE
# Snapshot all volumes
# (Via cloud provider console)

# 3. ASSESS DAMAGE
# Identify which systems are affected
# Check backups for integrity

# 4. DECLARE INCIDENT
# Follow incident response runbook
# Contact security team
```

**Recovery Steps**:
```bash
# 1. Wipe infected systems
# Rebuild all servers from scratch

# 2. Restore from known-good backups
# Use backups created before attack

# 3. Verify backup integrity
# Check hashes of backup files
# Scan for malware

# 4. Gradual restoration
# Start with critical services
# Monitor for suspicious activity

# 5. Post-incident review
# Identify attack vector
# Implement additional security measures
```

## Backup Testing

### Weekly Verification

```bash
#!/bin/bash
# scripts/verify-backups.sh

echo "Testing backup integrity..."

# Test PostgreSQL backup
TEST_DB="postgres://user:pass@test-host/test_db"
pg_restore $TEST_DB \
  --format=custom \
  --schema-only \
  /backups/postgres/latest.dump

if [ $? -eq 0 ]; then
  echo "✓ PostgreSQL backup valid"
else
  echo "✗ PostgreSQL backup CORRUPTED"
  exit 1
fi

# Test Qdrant snapshot
curl -f http://qdrant-test:6333/collections/_all/snapshots

if [ $? -eq 0 ]; then
  echo "✓ Qdrant snapshot valid"
else
  echo "✗ Qdrant snapshot CORRUPTED"
  exit 1
fi

# Test MinIO backup
mc ls --recursive s3://nexary-backups/minio/ | wc -l

echo "Backup verification complete"
```

### Quarterly Disaster Recovery Drill

```bash
# Schedule quarterly DR drill
# Test complete failover to backup region

1. Announce drill to team
2. Simulate production region failure
3. Execute failover procedures
4. Verify all services operational
5. Run smoke tests
6. Measure RTO/RPO
7. Document lessons learned
8. Update runbooks
```

## Monitoring and Alerts

### Backup Health Metrics

```yaml
alerts:
  - name: BackupFailure
    condition: backup_status != "success"
    severity: critical
    action: Page on-call

  - name: BackupStale
    condition: backup_age > 26 hours
    severity: warning
    action: Email on-call

  - name: BackupSizeAnomaly
    condition: backup_size < expected_size * 0.5
    severity: warning
    action: Create ticket
```

### Dashboard Metrics

- Last successful backup time
- Backup size trends
- Backup duration
- Restore test results
- Storage capacity usage

## Retention and Cleanup

### Retention Schedule

| Backup Type | Retention | Archive To |
|-------------|-----------|------------|
| PostgreSQL Daily | 30 days | Glacier (7 years) |
| PostgreSQL Weekly | 12 weeks | Glacier (7 years) |
| PostgreSQL Monthly | 12 months | Glacier (7 years) |
| Qdrant Snapshots | 7 days | - |
| Redis RDB | 7 days | - |
| MinIO Objects | 90 days | Glacier (7 years) |

### Automated Cleanup

```bash
#!/bin/bash
# scripts/cleanup-backups.sh

# PostgreSQL cleanup
aws s3 ls s3://nexary-backups/postgres/ | while read -r line; do
  createDate=$(echo $line | awk {'print $1" "$2'})
  createDate=$(date -d"$createDate" +%s)
  olderThan=$(date -d"$(date +%Y-%m-%d) -30 days" +%s)

  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo $line | awk {'print $4'})
    aws s3 rm s3://nexary-backups/postgres/$fileName
  fi
done

# Archive to Glacier
aws s3 mv s3://nexary-backups/postgres/old/ \
  s3://nexary-backups-glacier/postgres/ \
  --storage-class GLACIER
```

## Security Considerations

### Backup Encryption

```bash
# Encrypt backups with GPG
pg_dump $DATABASE_URL | \
  gpg --encrypt --recipient backup@nexary.ai | \
  aws s3 cp - s3://nexary-backups/postgres/encrypted.dump.gpg

# Decrypt for restore
aws s3 cp s3://nexary-backups/postgres/encrypted.dump.gpg - | \
  gpg --decrypt | \
  pg_restore $DATABASE_URL --format=custom
```

### Access Control

- Only backup admins can access backup bucket
- MFA required for backup operations
- Audit all backup/restore access
- Immutable backups (WORM) for compliance

### Backup Integrity

```bash
# Generate checksums
sha256sum /backups/postgres/*.dump > checksums.txt
aws s3 cp checksums.txt s3://nexary-backups/postgres/

# Verify before restore
aws s3 cp s3://nexary-backups/postgres/checksums.txt - | \
  sha256sum --check
```

## Communication

### Backup Status Report

```markdown
## Weekly Backup Status Report

**Week**: 2025-01-01 to 2025-01-07

### PostgreSQL
- Last backup: 2025-01-07 02:00 UTC ✓
- Size: 45.2 GB
- Duration: 12 minutes
- Status: Success

### Qdrant
- Last snapshot: 2025-01-07 06:00 UTC ✓
- Collections: 156
- Total size: 12.8 GB
- Status: Success

### Redis
- Last backup: 2025-01-07 03:00 UTC ✓
- Size: 2.1 GB
- Status: Success

### Issues
None

### Next Week
- Scheduled DR drill on Wednesday
```

## Documentation

### Runbook Updates

- After each incident, update recovery procedures
- Document new backup requirements
- Add lessons learned from drills
- Keep contact information current

### Training

- All engineers trained on basic restore procedures
- Quarterly DR drill participation
- Backup admin certification for ops team
- New hire training within first month

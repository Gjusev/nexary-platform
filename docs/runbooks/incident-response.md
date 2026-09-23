# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for handling common operational incidents in the Nexary platform.

## Incident Severity Levels

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| **P0 - Critical** | Complete system outage, data loss, or security breach | Immediate | Database down, data leak |
| **P1 - High** | Major feature unavailable, significant performance degradation | 15 minutes | Chat not working, RAG search fails |
| **P2 - Medium** | Partial feature unavailable, minor performance issues | 1 hour | Slow responses, intermittent errors |
| **P3 - Low** | Cosmetic issues, edge cases | 4 hours | Typos, non-critical bugs |

## Incident Response Process

### 1. Detection & Triage

#### Monitoring Dashboards
- **Application Health**: https://monitor.nexary.ai
- **Database Metrics**: https://db-monitor.nexary.ai
- **Error Tracking**: https://errors.nexary.ai
- **Status Page**: https://status.nexary.ai

#### Automated Alerts
Alerts are triggered via:
- PagerDuty (on-call rotation)
- Slack #incidents channel
- Email to on-call@nexary.ai

### 2. Initial Assessment

```bash
# Check system status
curl -f https://api.nexary.ai/health || echo "API unhealthy"

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check Redis
redis-cli -u $REDIS_URL ping

# Check Qdrant
curl -f $QDRANT_URL/health
```

### 3. Declare Incident

**Slack Command**:
```
/incident P0 - Database connectivity issues
```

**Required Information**:
- Severity level
- Brief description
- Affected services
- Current impact

### 4. Investigate

#### Gather Context
```bash
# Recent deployments
git log --since="2 hours ago" --oneline

# Recent error logs
kubectl logs -n production -l app=nexary --tail=1000 | grep ERROR

# Database locks
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state != 'idle'"

# Check rate limits
redis-cli -u $REDIS_URL get "rate_limit:status"
```

#### Common Investigation Commands
```bash
# Check pod status
kubectl get pods -n production

# Check resource usage
kubectl top pods -n production

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"
```

### 5. Mitigate

#### Apply temporary fix
- Scale up/down resources
- Restart affected services
- Disable problematic features
- Enable maintenance mode

#### Verify fix
```bash
# Health check
curl https://api.nexary.ai/health

# Smoke test
curl -X POST https://api.nexary.ai/api/chat/conversations \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -d '{"title":"test"}'
```

### 6. Resolve & Monitor

- Monitor for 30 minutes after fix
- Check metrics return to baseline
- Verify no downstream effects
- Close incident when stable

### 7. Post-Incident

- Write postmortem within 48 hours
- Create action items
- Update runbooks if needed
- Track follow-ups

## Common Incidents

### Database Connectivity Issues

**Symptoms**:
- "Database connection refused" errors
- Slow query responses
- Connection pool exhaustion

**Diagnosis**:
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Check long-running queries
psql $DATABASE_URL -c "SELECT pid, query, state, wait_event FROM pg_stat_activity WHERE state != 'idle'"
```

**Mitigation**:
```bash
# Option 1: Scale database
# (Via cloud provider console)

# Option 2: Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state != 'idle' AND query_start < now() - interval '5 minutes'"

# Option 3: Increase connection pool
# Update DATABASE_POOL_SIZE environment variable
```

**Prevention**:
- Implement connection pool limits
- Add query timeout guards
- Optimize slow queries
- Enable query caching

### High CPU/Memory Usage

**Symptoms**:
- Slow API responses
- Pod OOMKilled
- High latency

**Diagnosis**:
```bash
# Check pod resource usage
kubectl top pods -n production

# Check container metrics
kubectl describe pod <pod-name> -n production

# Check node resources
kubectl top nodes
```

**Mitigation**:
```bash
# Option 1: Scale up pods
kubectl scale deployment nexary-api --replicas=10 -n production

# Option 2: Increase resource limits
kubectl set resources deployment nexary-api \
  --limits=cpu=2,memory=4Gi \
  --requests=cpu=1,memory=2Gi \
  -n production

# Option 3: Enable autoscaling
kubectl autoscale deployment nexary-api \
  --cpu-percent=70 \
  --min=3 \
  --max=20 \
  -n production
```

**Prevention**:
- Set appropriate resource limits
- Implement Horizontal Pod Autoscaler (HPA)
- Profile memory usage regularly
- Optimize heavy computations

### Redis Cache Failure

**Symptoms**:
- Slower responses (missing cache)
- Session authentication failures
- Rate limiting not working

**Diagnosis**:
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis info
redis-cli -u $REDIS_URL info stats

# Check memory usage
redis-cli -u $REDIS_URL info memory
```

**Mitigation**:
```bash
# Option 1: Restart Redis (if cache miss is acceptable)
kubectl rollout restart deployment redis -n production

# Option 2: Scale Redis
# (Via cloud provider console)

# Option 3: Flush cache (if corruption suspected)
redis-cli -u $REDIS_URL FLUSHALL
```

**Prevention**:
- Enable Redis persistence (AOF)
- Set memory eviction policies
- Monitor cache hit rates
- Implement cache warmup

### Qdrant Vector DB Issues

**Symptoms**:
- RAG search returns no results
- Vector upload failures
- Slow similarity searches

**Diagnosis**:
```bash
# Check Qdrant health
curl $QDRANT_URL/health

# Check collection info
curl $QDRANT_URL/collections/{collection_id}

# Check cluster status
curl $QDRANT_URL/cluster
```

**Mitigation**:
```bash
# Option 1: Restart Qdrant
kubectl rollout restart deployment qdrant -n production

# Option 2: Optimize collection
curl -X POST $QDRANT_URL/collections/{collection_id}/optimize \
  -H "Content-Type: application/json"

# Option 3: recreate collection (if corrupted)
# Note: This requires re-indexing all vectors
```

**Prevention**:
- Monitor collection size
- Implement periodic optimization
- Enable Qdrant replication
- Backup collection snapshots

### API Rate Limiting Issues

**Symptoms**:
- "Rate limit exceeded" errors
- Legitimate users blocked
- uneven throttling

**Diagnosis**:
```bash
# Check current rate limits
redis-cli -u $REDIS_URL keys "rate_limit:*"

# Check specific user limits
redis-cli -u $REDIS_URL get "rate_limit:user:{user_id}"
```

**Mitigation**:
```bash
# Option 1: Increase rate limits temporarily
redis-cli -u $REDIS_URL SET "rate_limit:global:limit" 10000

# Option 2: Clear user's rate limit
redis-cli -u $REDIS_URL DEL "rate_limit:user:{user_id}"

# Option 3: Disable rate limiting (emergency only)
redis-cli -u $REDIS_URL SET "rate_limit:enabled" "false"
```

**Prevention**:
- Implement tiered rate limits
- Add rate limit headers to responses
- Monitor rate limit hit rates
- Provide rate limit status API

### Storage (MinIO) Issues

**Symptoms**:
- File upload failures
- Document download errors
- Presigned URL failures

**Diagnosis**:
```bash
# Check MinIO health
curl $MINIO_ENDPOINT/minio/health/live

# Check bucket status
mc ls minio/nexary-documents

# Check disk usage
mc admin info minio
```

**Mitigation**:
```bash
# Option 1: Restart MinIO
kubectl rollout restart statefulset minio -n production

# Option 2: Expand storage
# (Via cloud provider console)

# Option 3: Enable fallback to local storage
# Set MINIO_FALLBACK=true in environment
```

**Prevention**:
- Monitor storage capacity
- Implement lifecycle policies
- Enable versioning
- Regular backup to external storage

### Authentication Failures

**Symptoms**:
- Users unable to login
- "Invalid token" errors
- Session validation failures

**Diagnosis**:
```bash
# Check Stack Auth status
curl https://api.stack-auth.com/v1/health

# Check session storage
redis-cli -u $REDIS_URL keys "session:*"

# Verify Stack configuration
kubectl get configmap stack-config -n production -o yaml
```

**Mitigation**:
```bash
# Option 1: Clear stale sessions
redis-cli -u $REDIS_URL --scan --pattern "session:*" | xargs redis-cli -u $REDIS_URL DEL

# Option 2: Restart auth service
kubectl rollout restart deployment nexary-api -n production

# Option 3: Extend session timeout
# Update SESSION_MAX_AGE environment variable
```

**Prevention**:
- Monitor session validation rates
- Implement graceful token refresh
- Add monitoring for Stack Auth outages
- Cache Stack Auth responses

## Security Incidents

### Suspected Data Breach

**Immediate Actions**:
1. **DO NOT** modify affected systems
2. Isolate affected services from network
3. Enable additional logging
4. Preserve evidence (logs, memory dumps)

```bash
# Enable verbose logging
kubectl set env deployment nexary-api LOG_LEVEL=debug -n production

# Snapshot affected systems
# (Via cloud provider console)

# Enable network monitoring
kubectl apply -f manifests/network-monitor.yaml
```

### API Key Abuse

**Diagnosis**:
```bash
# Find suspicious API keys
redis-cli -u $REDIS_URL --scan --pattern "api_key:*" | while read key; do
  usage=$(redis-cli -u $REDIS_URL GET "$key:usage")
  if [ "$usage" -gt 10000 ]; then
    echo "$key: $usage requests"
  fi
done

# Check API key logs
psql $DATABASE_URL -c "SELECT * FROM api_key_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 100"
```

**Mitigation**:
```bash
# Revoke compromised API key
psql $DATABASE_URL -c "UPDATE api_keys SET is_active = false WHERE id = '<key_id>'"

# Notify key owner
# (Send email via notification service)

# Audit key usage
psql $DATABASE_URL -c "SELECT * FROM api_key_usage_logs WHERE api_key_id = '<key_id>' ORDER BY requested_at DESC"
```

## Communication Templates

### Initial Incident Declaration
```
🚨 **INCIDENT DECLARED** - P0 - Database Connectivity Issues

**Status**: Investigating
**Started**: 2025-01-01 12:00 UTC
**Impacted Services**: API, Dashboard, Chat
**Lead**: @on-call
**Channel**: #incident-2025-01-01-db

**Next Update**: 15 minutes
```

### Status Update
```
⏳ **INCIDENT UPDATE** - P0 - Database Connectivity Issues

**Status**: Mitigating
**Progress**: Identified root cause - connection pool exhaustion
**Action**: Scaling database, restarting application pods
**ETA**: 30 minutes to full recovery

**Next Update**: 15 minutes
```

### Resolution
```
✅ **INCIDENT RESOLVED** - P0 - Database Connectivity Issues

**Status**: Resolved
**Duration**: 2 hours
**Root Cause**: Connection pool exhaustion due to unindexed queries
**Fix**: Added indexes, increased pool size, restarted pods
**Prevention**: Query performance monitoring, alerting thresholds adjusted

**Postmortem**: https://docs.nexary.ai/postmortems/2025-01-01-db

**Thank you**: @on-call, @db-team, @sre-team
```

## Post-Incident Procedures

### Postmortem Template

```markdown
# Postmortem: [Incident Title]

**Date**: [Date]
**Severity**: [P0/P1/P2/P3]
**Duration**: [Start] - [End] ([X] hours)
**Lead**: [Name]

## Summary
[Brief description of what happened]

## Impact
- [Number] users affected
- [X] hours of downtime
- [Revenue/feature] impact

## Root Cause Analysis

### What happened?
[Timeline of events]

### Why did it happen?
[Technical root cause]

### Why wasn't it caught?
[Monitoring/gap analysis]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 12:00 | Alert triggered |
| 12:05 | Incident declared |
| 12:15 | Root cause identified |
| 12:30 | Mitigation applied |
| 14:00 | Service restored |

## Resolution
[What was done to fix it]

## Action Items
- [ ] **[P0]** [Action item] - [Owner] - [Due date]
- [ ] **[P1]** [Action item] - [Owner] - [Due date]

## Prevention
[What will prevent this from happening again]

## Lessons Learned
[What did we learn?]
```

## On-Call Responsibilities

### During Shift
- Monitor alerts and dashboards
- Respond to incidents within SLA
- Escalate if needed
- Document actions taken

### Handoff Procedures
```bash
# Run handoff checklist
./scripts/oncall-handoff.sh

# Update on-call status
slack status set "On-call for Nexary" --emoji ":pagerduty:"

# Verify phone forwarding
# (Call forwarding setup)
```

### Training Requirements
- All engineers must complete incident response training
- Quarterly drill participation required
- Shadow on-call before taking primary role

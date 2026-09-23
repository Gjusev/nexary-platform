# Deployment Runbook

## Overview

This runbook covers the deployment process for the Nexary platform, including staging, production releases, and rollback procedures.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing locally
- [ ] Code reviewed by at least one team member
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Translation keys validated (`npm run check-translations`)

### Documentation
- [ ] CHANGELOG.md updated
- [ ] Migration scripts prepared (if needed)
- [ ] Breaking changes documented
- [ ] Feature flags configured

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual QA completed on staging
- [ ] Performance tests pass (if applicable)

### Security
- [ ] No sensitive data in code
- [ ] Dependencies scanned for vulnerabilities
- [ ] Security review completed (for major changes)

## Deployment Process

### 1. Prepare Release

```bash
# Create release branch
git checkout -b release/v1.2.3

# Update version numbers
npm version 1.2.3

# Update CHANGELOG
# (Manually update CHANGELOG.md)

# Commit changes
git add .
git commit -m "chore: prepare release v1.2.3"

# Tag release
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin release/v1.2.3 --tags
```

### 2. Deploy to Staging

```bash
# Set kubectl context to staging
kubectl config use-context nexary-staging

# Build and push Docker image
docker build -t nexary:v1.2.3 .
docker tag nexary:v1.2.3 registry.nexary.ai/nexary:v1.2.3-staging
docker push registry.nexary.ai/nexary:v1.2.3-staging

# Update deployment
kubectl set image deployment/nexary-api \
  nexary-api=registry.nexary.ai/nexary:v1.2.3-staging \
  -n staging

# Watch rollout
kubectl rollout status deployment/nexary-api -n staging

# Verify health
kubectl get pods -n staging
curl https://staging.nexary.ai/health
```

### 3. Staging Verification

```bash
# Run smoke tests
npm run test:e2e -- --env=staging

# Manual QA checklist
- [ ] Login/logout works
- [ ] Chat functionality works
- [ ] RAG document upload works
- [ ] Team features work
- [ ] API endpoints respond correctly

# Check logs for errors
kubectl logs -n staging -l app=nexary-api --tail=100 | grep -i error
```

### 4. Database Migrations

```bash
# Review migration plan
cat migrations/20250101_add_new_feature.sql

# Test migration on staging database
psql $STAGING_DATABASE_URL -f migrations/20250101_add_new_feature.sql

# Verify migration results
psql $STAGING_DATABASE_URL -c "\d new_table"

# If issues, rollback migration
psql $STAGING_DATABASE_URL -f migrations/rollback/20250101_add_new_feature.sql
```

### 5. Deploy to Production

```bash
# Set kubectl context to production
kubectl config use-context nexary-production

# Build production image
docker build -t nexary:v1.2.3 .
docker tag nexary:v1.2.3 registry.nexary.ai/nexary:v1.2.3
docker push registry.nexary.ai/nexary:v1.2.3

# Update deployment (canary strategy)
kubectl set image deployment/nexary-api-canary \
  nexary-api=registry.nexary.ai/nexary:v1.2.3 \
  -n production

# Monitor canary
kubectl get pods -n production -l track=canary

# If canary successful, rollout to rest
kubectl set image deployment/nexary-api \
  nexary-api=registry.nexary.ai/nexary:v1.2.3 \
  -n production

# Watch rollout
kubectl rollout status deployment/nexary-api -n production
```

### 6. Production Verification

```bash
# Health checks
curl https://api.nexary.ai/health
curl https://app.nexary.ai/health

# Check error rates
# (Via monitoring dashboard)

# Run production smoke tests
npm run test:smoke -- --env=production

# Monitor logs for 10 minutes
kubectl logs -n production -l app=nexary-api --tail=100 -f | grep -i error
```

### 7. Database Migration (Production)

```bash
# Create backup before migration
pg_dump $PRODUCTION_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration
psql $PRODUCTION_DATABASE_URL -f migrations/20250101_add_new_feature.sql

# Verify migration
psql $PRODUCTION_DATABASE_URL -c "\d new_table"
psql $PRODUCTION_DATABASE_URL -c "SELECT count(*) FROM new_table"

# Monitor for issues
kubectl logs -n production -l app=nexary-api --tail=100
```

### 8. Post-Deployment

```bash
# Update documentation
# Update deployment runbook if needed

# Monitor metrics
# - Error rate
# - Latency
# - Throughput
# - Resource usage

# Create GitHub release
gh release create v1.2.3 --notes "Release v1.2.3"

# Announce release
# - Internal Slack
# - User email (if applicable)
# - Changelog update
```

## Deployment Strategies

### Blue-Green Deployment

Two identical environments, switch traffic between them.

```bash
# Deploy to green (inactive)
kubectl apply -f manifests/deployment-green.yaml

# Verify green is healthy
kubectl wait --for=condition=available deployment/nexary-api-green -n production

# Switch traffic to green
kubectl apply -f manifests/service-green.yaml

# Scale down blue (old)
kubectl scale deployment/nexary-api-blue --replicas=0 -n production
```

**Pros**:
- Instant rollback
- Zero downtime
- Easy testing

**Cons**:
- Double resource costs
- Complex stateful data handling

### Canary Deployment

Gradually roll out to subset of users.

```bash
# Deploy canary (10% traffic)
kubectl apply -f manifests/deployment-canary.yaml
kubectl apply -f manifests/service-canary.yaml

# Monitor metrics
# (Via monitoring dashboard)

# If good, increase to 50%
kubectl patch service nexary-api -p '{"spec":{"selector":{"track":"canary"}}}' -n production

# If good, 100% rollout
kubectl apply -f manifests/deployment.yaml
```

**Pros**:
- Gradual exposure
- Easy rollback
- Low risk

**Cons**:
- Complex to set up
- Longer deployment time

### Rolling Update

Gradually replace old pods with new ones.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1  # Max pods that can be down
      maxSurge: 1        # Max extra pods
```

```bash
# Apply rolling update
kubectl apply -f manifests/deployment.yaml

# Monitor rollout
kubectl rollout status deployment/nexary-api -n production
```

**Pros**:
- Simple to set up
- Built into Kubernetes
- Zero downtime (mostly)

**Cons**:
- Limited traffic control
- Harder to rollback mid-rollout

## Rollback Procedures

### Immediate Rollback (Traffic)

```bash
# Revert traffic to previous version
kubectl rollout undo deployment/nexary-api -n production

# Verify rollback
kubectl rollout status deployment/nexary-api -n production
kubectl get pods -n production
```

### Rollback with Database Changes

```bash
# Rollback application
kubectl rollout undo deployment/nexary-api -n production

# Rollback database migration
psql $PRODUCTION_DATABASE_URL -f migrations/rollback/20250101_add_new_feature.sql

# Verify data integrity
psql $PRODUCTION_DATABASE_URL -c "SELECT count(*) FROM users"

# Check logs for errors
kubectl logs -n production -l app=nexary-api --tail=100
```

### Complete Rollback (Previous Version)

```bash
# Check rollout history
kubectl rollout history deployment/nexary-api -n production

# Rollback to specific revision
kubectl rollout undo deployment/nexary-api --to-revision=3 -n production

# Or redeploy previous image
kubectl set image deployment/nexary-api \
  nexary-api=registry.nexary.ai/nexary:v1.2.2 \
  -n production
```

## Emergency Procedures

### Hotfix Deployment

```bash
# Create hotfix branch from main
git checkout -b hotfix/critical-bug-fix

# Make fix and test
# ...

# Tag as hotfix version
git tag -a v1.2.4-hotfix -m "Hotfix: critical bug fix"

# Deploy directly to production (skip staging for critical issues)
docker build -t nexary:v1.2.4-hotfix .
docker push registry.nexary.ai/nexary:v1.2.4-hotfix

kubectl set image deployment/nexary-api \
  nexary-api=registry.nexary.ai/nexary:v1.2.4-hotfix \
  -n production

# Monitor closely
kubectl logs -n production -l app=nexary-api -f
```

### Rollback Entire Release

```bash
# Stop rollout
kubectl rollout pause deployment/nexary-api -n production

# Rollback to previous stable version
kubectl rollout undo deployment/nexary-api -n production

# Rollback database migrations
for migration in migrations/rollback/*.sql; do
  psql $PRODUCTION_DATABASE_URL -f "$migration"
done

# Verify system health
curl https://api.nexary.ai/health

# Declare incident if needed
# (Follow incident response runbook)
```

## Deployment Environments

### Development
- **URL**: http://localhost:3000
- **Purpose**: Local development
- **Data**: Seeded test data
- **Deployment**: `npm run dev`

### Staging
- **URL**: https://staging.nexary.ai
- **Purpose**: Pre-production testing
- **Data**: Anonymized production copy
- **Deployment**: Automatic on merge to `main`
- **Auto-deploy**: Enabled

### Production
- **URL**: https://app.nexary.ai
- **Purpose**: Live production system
- **Data**: Real user data
- **Deployment**: Manual via CI/CD
- **Auto-deploy**: Disabled (requires approval)

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to staging
        run: |
          # Build and deploy
          kubectl config use-context nexary-staging
          kubectl set image deployment/nexary-api nexary-api=registry.nexary.ai/nexary:${{ github.sha }} -n staging

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.nexary.ai
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Manual approval required
          kubectl config use-context nexary-production
          kubectl set image deployment/nexary-api nexary-api=registry.nexary.ai/nexary:${{ github.sha }} -n production
```

## Feature Flags

### Using Feature Flags

```typescript
// lib/feature-flags.ts
export const featureFlags = {
  NEW_RAG_SEARCH: process.env.FEATURE_NEW_RAG_SEARCH === 'true',
  DARK_MODE: process.env.FEATURE_DARK_MODE === 'true',
  ADVANCED_ANALYTICS: process.env.FEATURE_ADVANCED_ANALYTICS === 'true',
};

// Usage in component
if (featureFlags.NEW_RAG_SEARCH) {
  // Use new search
} else {
  // Use old search
}
```

### Managing Flags via Environment

```bash
# Enable feature
kubectl set env deployment/nexary-api FEATURE_NEW_RAG_SEARCH=true -n production

# Disable feature
kubectl set env deployment/nexary-api FEATURE_NEW_RAG_SEARCH=false -n production

# Remove flag (use default)
kubectl set env deployment/nexary-api FEATURE_NEW_RAG_SEARCH- -n production
```

## Monitoring Deployment Health

### Health Checks

```bash
# API health
curl https://api.nexary.ai/health

# Deep health check
curl https://api.nexary.ai/health/deep

# Readiness check
curl https://api.nexary.ai/health/ready
```

### Metrics to Monitor

- **Pod Status**: All pods running and ready
- **Error Rate**: < 0.1% (5xx errors)
- **Latency**: p95 < 500ms
- **Throughput**: Requests/sec stable
- **Database**: Connection pool healthy
- **Cache**: Hit rate > 80%

### Alerting

Alert on:
- Pod crash loop
- Health check failures
- Error rate spike
- Latency increase
- Database connection issues

## Best Practices

1. **Small, Frequent Releases**: Easier to debug and rollback
2. **Automated Testing**: Catch issues before production
3. **Gradual Rollout**: Use canary or blue-green deployments
4. **Monitor Actively**: Watch metrics closely after deployment
5. **Prepare Rollback**: Always know how to rollback quickly
6. **Document Changes**: Keep CHANGELOG updated
7. **Test Migrations**: Verify migrations work on staging first
8. **Feature Flags**: Use for gradual feature rollout
9. **Database Backups**: Always backup before schema changes
10. **Post-Deployment Review**: Learn from each deployment

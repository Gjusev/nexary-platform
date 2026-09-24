# Alerting Configuration Guide

This guide covers setting up and configuring alerts for the Nexary monitoring system.

## Alert Channels

### Sentry Alerts

Sentry provides built-in alerting for errors and performance issues.

#### Setting up Sentry Alerts

1. **Navigate to Sentry Alerts**
   - Go to your Sentry project
   - Settings > Alerts > New Alert Rule

2. **Error Rate Alerts**
   ```
   Condition: Error rate > 5% in 5 minutes
   Severity: Critical
   Notify: Email, Slack
   ```

3. **Performance Alerts**
   ```
   Condition: P95 response time > 2000ms
   Severity: Warning
   Notify: Email, Slack
   ```

4. **Recommended Alert Rules**
   - Error rate > 5% in 5 minutes (Critical)
   - Error rate > 1% in 15 minutes (Warning)
   - New issue with tag "production" (Critical)
   - P95 response time > 3000ms (Critical)
   - P95 response time > 2000ms (Warning)
   - Failed login attempts > 10 per minute (Critical)

### Datadog Alerts

If using Datadog for metrics and monitoring:

#### Critical Alerts

```yaml
- name: "High Error Rate"
  type: "metric alert"
  query: "avg(last_5m):sum:api.errors{env:production} / sum:api.requests{env:production} > 0.05"
  message: "Error rate is above 5% in production"
  priority: P1
  tags: [critical, production]

- name: "Database Connection Failure"
  type: "service check"
  query: "avg(last_2m):avg:health.database.status{env:production} < 1"
  message: "Database is unhealthy or unreachable"
  priority: P1
  tags: [critical, database]

- name: "Redis Connection Failure"
  type: "service check"
  query: "avg(last_2m):avg:health.redis.status{env:production} < 1"
  message: "Redis is unhealthy or unreachable"
  priority: P1
  tags: [critical, cache]

- name: "Storage Failure"
  type: "service check"
  query: "avg(last_2m):avg:health.storage.status{env:production} < 1"
  message: "Object storage (MinIO) is unhealthy"
  priority: P1
  tags: [critical, storage]

- name: "Qdrant Vector DB Failure"
  type: "service check"
  query: "avg(last_2m):avg:health.qdrant.status{env:production} < 1"
  message: "Qdrant vector database is unhealthy"
  priority: P1
  tags: [critical, vector-db]
```

#### Warning Alerts

```yaml
- name: "High Response Time"
  type: "metric alert"
  query: "avg(last_10m):avg:api.response_time{env:production} > 2000"
  message: "Average API response time is above 2 seconds"
  priority: P2
  tags: [warning, performance]

- name: "High Memory Usage"
  type: "metric alert"
  query: "avg(last_5m):avg:system.memory.used{env:production} / avg:system.memory.total{env:production} > 0.85"
  message: "Memory usage is above 85%"
  priority: P2
  tags: [warning, infrastructure]

- name: "High CPU Usage"
  type: "metric alert"
  query: "avg(last_10m):avg:system.cpu.usage{env:production} > 80"
  message: "CPU usage is above 80%"
  priority: P2
  tags: [warning, infrastructure]

- name: "Low Cache Hit Rate"
  type: "metric alert"
  query: "avg(last_15m):sum:cache.hit{env:production} / (sum:cache.hit{env:production} + sum:cache.miss{env:production}) < 0.7"
  message: "Cache hit rate is below 70%"
  priority: P3
  tags: [warning, performance]

- name: "Database Query Time"
  type: "metric alert"
  query: "avg(last_10m):avg:db.query.time{env:production} > 1000"
  message: "Average database query time is above 1 second"
  priority: P2
  tags: [warning, database, performance]
```

#### Business Alerts

```yaml
- name: "RAG Document Processing Failure Rate"
  type: "metric alert"
  query: "avg(last_10m):sum:rag.document.process_failed{env:production} / sum:rag.document.processed{env:production} > 0.1"
  message: "RAG document processing failure rate is above 10%"
  priority: P2
  tags: [warning, rag]

- name: "AI Provider Error Rate"
  type: "metric alert"
  query: "avg(last_5m):sum:ai.call_error{env:production} / sum:ai.call_total{env:production} > 0.05"
  message: "AI provider error rate is above 5%"
  priority: P2
  tags: [warning, ai]

- name: "High Token Usage"
  type: "metric alert"
  query: "sum(last_1h):sum:ai.tokens_used{env:production} > 1000000"
  message: "Token usage is above 1 million in the last hour"
  priority: P3
  tags: [info, cost]
```

### Slack Integration

#### Slack Webhook Alerts

Create a Slack webhook and configure alerts to post to specific channels:

```typescript
// lib/monitoring/alerts.ts
export async function sendSlackAlert(message: string, severity: 'info' | 'warning' | 'critical') {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const emoji = severity === 'critical' ? ':rotating_light:' : severity === 'warning' ? ':warning:' : ':information_source:';
  const color = severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'good';

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${emoji} ${severity.toUpperCase()}: ${message}`,
      attachments: [{
        color,
        text: message,
        fields: [
          { title: 'Severity', value: severity, short: true },
          { title: 'Time', value: new Date().toISOString(), short: true },
        ],
      }],
    }),
  });
}
```

### Email Alerts

Configure email notifications through Sentry or Datadog:

```typescript
// Send critical errors to email
export async function sendEmailAlert(message: string, details: Record<string, unknown>) {
  // Implementation depends on your email service
  // Could use SendGrid, AWS SES, or similar
}
```

## Alert Escalation Policy

### Priority Levels

- **P1 - Critical**: Immediate action required, page on-call engineer
  - Service down (error rate > 50%)
  - Database failure
  - Security breach detected
  - Data loss risk

- **P2 - High**: Action required within 15 minutes
  - High error rate (> 5%)
  - Performance degradation (P95 > 3s)
  - Partial service failure

- **P3 - Medium**: Action required within 1 hour
  - Moderate error rate (> 1%)
  - Performance degradation (P95 > 2s)
  - Cache issues

- **P4 - Low**: Action required within 1 day
  - Low error rate (< 1%)
  - Minor performance issues
  - Business metric anomalies

### Escalation Rules

```yaml
escalation_policy:
  P1:
    - wait: 0 minutes
      notify: ["on-call-engineer", "engineering-manager"]
    - wait: 15 minutes
      notify: ["cto", "vp-engineering"]
    - wait: 30 minutes
      notify: ["all-engineers"]

  P2:
    - wait: 0 minutes
      notify: ["on-call-engineer"]
    - wait: 30 minutes
      notify: ["engineering-lead"]
    - wait: 2 hours
      notify: ["engineering-manager"]

  P3:
    - wait: 0 minutes
      notify: ["engineering-team-slack"]
    - wait: 1 day
      notify: ["engineering-lead"]

  P4:
    - wait: 0 minutes
      notify: ["engineering-team-slack"]
```

## On-Call Procedures

### Runbook Template

Create runbooks for common scenarios:

```markdown
# High Error Rate Alert

## Severity: P1/P2

## Symptoms
- Error rate > 5% in production
- Users experiencing failures
- Sentry showing spike in errors

## Initial Checks
1. Check Sentry for error patterns
2. Check health endpoint: `/api/health`
3. Check recent deployments
4. Check database connectivity

## Common Causes
- Recent deployment introduced bugs
- Database connection pool exhausted
- External API failure (AI providers)
- Configuration error

## Resolution Steps
1. If recent deployment, consider rollback
2. Check and restart services if needed
3. Scale up database connection pool
4. Verify environment variables
5. Check external service status pages

## Escalation
If not resolved in 15 minutes, escalate to P1 procedures
```

## Testing Alerts

### Regular Testing Schedule

- **Weekly**: Verify alert delivery to Slack
- **Monthly**: Test on-call rotation and escalation
- **Quarterly**: Review and update alert thresholds
- **Annually**: Full disaster recovery drill

### Alert Churn Monitoring

Monitor for alert fatigue:

```typescript
// Track alert frequency
telemetry.increment('alert.sent', {
  severity: 'critical',
  type: 'error_rate',
});

// Alert on too many alerts
if (alertCount > threshold) {
  sendSlackAlert('Alert fatigue detected! Too many alerts firing.', 'warning');
}
```

## Maintenance Windows

### Silencing Alerts During Maintenance

```typescript
// Set maintenance mode
process.env.MAINTENANCE_MODE = 'true';

// In alert logic, check maintenance mode
if (process.env.MAINTENANCE_MODE === 'true') {
  // Skip non-critical alerts during maintenance
  if (severity !== 'critical') return;
}
```

## Continuous Improvement

### Alert Review Process

1. **Monthly Alert Review**
   - Review all alerts from the past month
   - Identify false positives
   - Adjust thresholds
   - Add missing alerts
   - Remove unused alerts

2. **Metrics to Track**
   - Alert accuracy (true positive rate)
   - Mean time to acknowledge (MTTA)
   - Mean time to resolve (MTTR)
   - Alert frequency per week
   - False positive rate

### Alert Tuning Guidelines

- **If too many false positives**: Increase threshold, add conditions
- **If missing real issues**: Lower threshold, add more alerts
- **If alerts are ignored**: Make them more actionable, reduce noise
- **If slow response**: Escalate to higher priority, add more channels

## Environment Variables

```env
# Alert Configuration
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_TO=oncall@example.com
ALERT_EMAIL_FROM=nexary@example.com

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERT_CHANNEL=#alerts

SENTRY_ALERT_ENABLED=true
DATADOG_ALERT_ENABLED=true

# Maintenance Mode
MAINTENANCE_MODE=false

# On-Call Configuration
ON_CALL_ENABLED=true
ON_CALL_PHONE=+1234567890
ON_CALL_EMAIL=oncall@example.com
```

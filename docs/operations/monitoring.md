# Monitoring and Observability Guide

This guide covers the comprehensive monitoring and observability system implemented for Nexary.

## Overview

The monitoring system provides:

- **Error Tracking**: Sentry for real-time error monitoring and alerting
- **Structured Logging**: Pino-based JSON logging for production environments
- **Metrics Collection**: Business and performance metrics tracking
- **Health Checks**: System health monitoring for all components
- **Performance Monitoring**: APM integration for tracing and profiling
- **Dashboard UI**: Real-time monitoring dashboard for administrators

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Nexary Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  API Routes      │  │  Server Actions  │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                            │
│           └──────────┬──────────┘                            │
│                      │                                       │
│           ┌──────────▼──────────┐                            │
│           │ Monitoring Middleware│                            │
│           └──────────┬──────────┘                            │
│                      │                                       │
│  ┌───────────────────┼───────────────────┐                  │
│  │                   │                   │                  │
│  ▼                   ▼                   ▼                  │
│ ┌─────────┐      ┌─────────┐       ┌─────────┐             │
│ │ Sentry  │      │ Pino    │       │Telemetry│             │
│ │ (Errors)│      │ (Logs)  │       │(Metrics)│             │
│ └────┬────┘      └────┬────┘       └────┬────┘             │
│      │                │                 │                   │
│      └────────────────┼─────────────────┘                   │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │ Monitoring      │                            │
│              │ Dashboard UI    │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ External Services         │
        ├──────────────────────────┤
        │ • Sentry Cloud            │
        │ • Datadog (optional)      │
        │ • Log aggregation         │
        │ • Alerting channels       │
        └──────────────────────────┘
```

## Components

### 1. Sentry Integration

**Files**: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

Sentry provides:
- Real-time error tracking
- Performance monitoring
- Session replay for debugging
- Release tracking
- User context for errors

**Features**:
- Automatic error capture
- Performance tracing (10% sample rate)
- Session replay (10% of sessions, 100% on error)
- Sensitive data filtering
- Environment-aware configuration

### 2. Structured Logging

**File**: `lib/monitoring/structured-logger.ts`

Pino-based logger with:
- JSON output for production
- Pretty-printed output for development
- Automatic request tracking
- Domain-specific loggers
- Sensitive data redaction

**Usage**:
```typescript
import { structuredLogger, structuredLoggers } from '@/lib/monitoring/structured-logger';

// Basic logging
structuredLogger.info('User logged in', { userId: '123' });

// Domain-specific logging
structuredLoggers.api.logRequest({
  method: 'GET',
  url: '/api/chat',
  statusCode: 200,
  duration: 150,
});

structuredLoggers.db.logQuery({
  table: 'users',
  operation: 'SELECT',
  duration: 25,
  success: true,
});

structuredLoggers.ai.logAICall({
  provider: 'openai',
  model: 'gpt-4',
  tokensUsed: 1500,
  duration: 2000,
  success: true,
});
```

### 3. Telemetry and Metrics

**File**: `lib/monitoring/telemetry.ts`

Metrics collection system tracking:
- Business metrics (user actions, conversions)
- Performance metrics (response times, throughput)
- System metrics (database, cache, storage)
- Custom metrics (token usage, RAG operations)

**Usage**:
```typescript
import { telemetry, Metrics, trackApiRequest, trackChatMessage } from '@/lib/monitoring/telemetry';

// Counter metrics
telemetry.increment(Metrics.CHAT_MESSAGE_SENT, { provider: 'openai' });

// Gauge metrics
telemetry.gauge(Metrics.CHAT_TOKEN_USAGE, 1500, { provider: 'openai' });

// Timing metrics
const timer = telemetry.startTimer('api.request.duration');
// ... do work ...
timer.stop();

// Helper functions
trackApiRequest('/api/chat', 'POST', 200, 150);
trackChatMessage(1500, 2000, 'openai');
```

### 4. Monitoring Middleware

**File**: `lib/monitoring/middleware.ts`

Automatic monitoring for API routes and server actions:
- Request tracking
- Performance measurement
- Error logging
- Metrics collection

**Usage**:
```typescript
import { withMonitoring } from '@/lib/monitoring/middleware';

export const GET = withMonitoring(async (req, context) => {
  // Your handler code
  return NextResponse.json({ success: true });
});
```

### 5. Health Checks

**Files**:
- `app/api/health/route.ts` - Comprehensive health check
- `app/api/health/ready/route.ts` - Readiness probe
- `app/api/health/live/route.ts` - Liveness probe

**Health Check Endpoints**:

```bash
# Full health check
GET /api/health
# Returns: Database, Redis, Storage, Qdrant status + system metrics

# Readiness check (lightweight)
GET /api/health/ready
# Returns: Service ready status

# Liveness check (minimal)
GET /api/health/live
# Returns: Service alive status
```

### 6. Monitoring Dashboard

**File**: `app/(authenticated)/dashboard/monitoring/page.tsx`

Web dashboard providing:
- System health overview
- Service status (Database, Redis, Storage, Qdrant)
- Performance metrics (CPU, Memory)
- Auto-refresh capability

**Access**: `/dashboard/monitoring` (Admin only)

## Configuration

### Environment Variables

```env
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
SENTRY_REPLAY_ERROR_SAMPLE_RATE=1.0

# Public Sentry Configuration (client-side)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE=1.0

# Logging Configuration
LOG_LEVEL=info
ENABLE_TELEMETRY=true

# Datadog Configuration (optional)
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=datadoghq.com

# Alert Configuration
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_TO=alerts@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Log Levels

- `debug`: Detailed information for debugging
- `info`: General informational messages (default)
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Critical errors requiring immediate attention

## Metrics Reference

### Business Metrics

| Metric Name | Type | Description |
|------------|------|-------------|
| `auth.login.success` | Counter | Successful user logins |
| `auth.login.failure` | Counter | Failed login attempts |
| `chat.message.sent` | Counter | Chat messages sent |
| `chat.token.usage` | Gauge | AI tokens consumed |
| `rag.document.upload` | Counter | Documents uploaded |
| `rag.query.performed` | Counter | RAG queries executed |
| `team.created` | Counter | Teams created |

### Performance Metrics

| Metric Name | Type | Description |
|------------|------|-------------|
| `api.request` | Counter | API requests received |
| `api.response_time` | Timing | API response duration |
| `api.error` | Counter | API errors |
| `db.query.time` | Timing | Database query duration |
| `cache.hit` | Counter | Cache hits |
| `cache.miss` | Counter | Cache misses |
| `ai.call_duration` | Timing | AI provider call duration |

### System Metrics

| Metric Name | Type | Description |
|------------|------|-------------|
| `health.database.latency` | Gauge | Database response time |
| `health.redis.latency` | Gauge | Redis response time |
| `health.storage.latency` | Gauge | Storage response time |
| `health.qdrant.latency` | Gauge | Qdrant response time |
| `system.memory.used` | Gauge | Memory consumption |
| `system.cpu.usage` | Gauge | CPU usage |

## Best Practices

### 1. Logging

- **Use structured logging** with context
- **Log at appropriate levels** (debug for development, info for production)
- **Include request IDs** for traceability
- **Redact sensitive data** (passwords, tokens, emails)
- **Use domain loggers** for better organization

### 2. Metrics

- **Track business KPIs** that matter
- **Use consistent naming** (metric.name with tags)
- **Include units** in metric names (ms, bytes, etc.)
- **Don't track everything** - focus on actionable metrics
- **Set up alerts** for critical metrics

### 3. Error Tracking

- **Add user context** to errors
- **Include custom tags** for filtering
- **Set appropriate sample rates** for performance
- **Review Sentry regularly** for new issues
- **Create releases** for deployment tracking

### 4. Health Checks

- **Keep liveness checks lightweight** (just verify process is alive)
- **Readiness checks verify dependencies** (database, Redis, etc.)
- **Full health checks include metrics** (latency, resource usage)
- **Use appropriate HTTP status codes** (200 for healthy, 503 for unhealthy)

### 5. Alerting

- **Alert on symptoms, not causes** (high error rate, not "database slow")
- **Set thresholds appropriately** (avoid alert fatigue)
- **Create escalation policies** (P1 → page on-call, P4 → Slack)
- **Document runbooks** for common issues
- **Review and tune alerts regularly**

## Troubleshooting

### Issues

**Sentry not receiving errors**:
- Check SENTRY_DSN is correct
- Verify network connectivity to Sentry
- Check beforeSend filters aren't blocking events
- Ensure NODE_ENV is not "development"

**Logs not appearing**:
- Check LOG_LEVEL environment variable
- Verify log aggregation is configured
- Check disk space on log storage
- Review log rotation settings

**Health checks failing**:
- Check database connectivity
- Verify Redis is running
- Check Qdrant service status
- Verify MinIO/S3 configuration
- Review firewall rules

**High memory usage**:
- Check for memory leaks
- Review database connection pool size
- Monitor Redis memory usage
- Check for large file uploads
- Review caching strategy

## Monitoring Tools

### Recommended Tools

1. **Sentry** - Error tracking and performance monitoring (implemented)
2. **Datadog** - Full-stack monitoring and metrics (optional integration)
3. **Grafana** - Dashboard and visualization (can be added)
4. **Prometheus** - Metrics collection and alerting (can be added)
5. **ELK Stack** - Log aggregation and search (can be added)

### Integration Examples

**Prometheus Integration**:
```typescript
import { register } from 'prom-client';

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Grafana Dashboards**:
- Import dashboard JSON from `docs/grafana-dashboards/`
- Configure Prometheus datasource
- Set up alerts in Grafana

## Security Considerations

### Data Protection

- **Redact sensitive data** from logs and errors
- **Use secure connections** (HTTPS, TLS)
- **Restrict access** to monitoring dashboards
- **Encrypt logs** at rest and in transit
- **Implement retention policies** for logs

### Access Control

- **Role-based access** to monitoring tools
- **Audit log access** for compliance
- **Use service accounts** for integrations
- **Rotate API keys** regularly
- **Monitor for anomalies** in monitoring data

## Compliance

### GDPR

- **Don't log PII** (personally identifiable information)
- **Anonymize user IDs** in logs
- **Implement data deletion** on request
- **Provide export** of user monitoring data
- **Document processing** activities

### SOC 2

- **Maintain audit logs** for all access
- **Implement change management** for monitoring configs
- **Regular security reviews** of monitoring data
- **Incident response procedures** documented
- **Business continuity** planning

## Further Reading

- [Sentry Documentation](https://docs.sentry.io/)
- [Pino Documentation](https://getpino.io/)
- [Datadog Monitoring](https://docs.datadoghq.com/)
- [Alerting Guide](alerting.md)
- [Runbooks](../runbooks/)

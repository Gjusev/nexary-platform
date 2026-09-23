# Migration and Testing Guide - Phases 5-7

This guide provides step-by-step instructions for deploying and testing the new API Keys and AI Cost Tracking features.

---

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Database Migrations](#database-migrations)
3. [API Keys Testing](#api-keys-testing)
4. [Cost Tracking Testing](#cost-tracking-testing)
5. [Verification Checklist](#verification-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Pre-Migration Checklist

Before running migrations, ensure you have:

- [ ] Database backup created
- [ ] Access to PostgreSQL database with admin privileges
- [ ] Environment variables configured
- [ ] Application deployed with latest code
- [ ] Database connection string verified

### Backup Your Database

```bash
# PostgreSQL backup
pg_dump -U your_user -h your_host -d projectnexus > backup_before_phases5-7_$(date +%Y%m%d).sql

# Or using docker
docker exec postgres_container pg_dump -U your_user projectnexus > backup.sql
```

---

## Database Migrations

### Step 1: Verify Current Schema

```sql
-- Check existing tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'projectnexus'
ORDER BY table_name;
```

### Step 2: Run Migrations in Order

**IMPORTANT**: Migrations MUST be run in order to respect foreign key constraints.

```bash
# Option 1: Using psql directly
psql -U your_user -h your_host -d projectnexus -f migrations/011_team_api_keys.sql
psql -U your_user -h your_host -d projectnexus -f migrations/012_ai_usage_tracking.sql
psql -U your_user -h your_host -d projectnexus -f migrations/013_team_audit_logs.sql

# Option 2: Using Docker
docker exec -i postgres_container psql -U your_user -d projectnexus < migrations/011_team_api_keys.sql
docker exec -i postgres_container psql -U your_user -d projectnexus < migrations/012_ai_usage_tracking.sql
docker exec -i postgres_container psql -U your_user -d projectnexus < migrations/013_team_audit_logs.sql

# Option 3: Using migration tool (if configured)
npm run migrate:up
```

### Step 3: Verify Migration Success

```sql
-- Verify API Keys tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'projectnexus'
  AND table_name LIKE '%api_key%';

-- Expected result:
-- table_api_keys
-- team_api_key_usage

-- Verify Cost Tracking tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'projectnexus'
  AND table_name LIKE '%ai_%';

-- Expected result:
-- ai_usage_logs
-- ai_cost_settings
-- ai_budget_alerts

-- Verify Audit Logs table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'projectnexus'
  AND table_name = 'team_audit_logs';
```

### Step 4: Verify Indexes and Constraints

```sql
-- Check indexes on team_api_keys
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'team_api_keys'
  AND schemaname = 'projectnexus';

-- Check indexes on ai_usage_logs
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ai_usage_logs'
  AND schemaname = 'projectnexus';

-- Expected indexes:
-- - idx_team_api_keys_team_slug
-- - idx_team_api_keys_key_hash
-- - idx_ai_usage_logs_team_slug
-- - idx_ai_usage_logs_created_at
-- - idx_ai_usage_logs_team_created
```

---

## API Keys Testing

### Test 1: Create API Key via UI

1. Navigate to: `https://your-domain.com/dashboard/settings/api-keys`
2. Click "Nueva Clave" or "New API Key"
3. Fill in the form:
   - **Name**: `Test Integration Key`
   - **Scopes**: Select `read:chat` and `write:chat`
   - **Expiration**: Leave empty (no expiration)
4. Click "Crear" or "Create"
5. **Expected Result**:
   - Success toast notification appears
   - API key is shown in an alert banner (format: `nxak_...`)
   - Key is displayed in the table

6. **IMPORTANT**: Copy the API key now (it won't be shown again!)

### Test 2: Validate API Key

```bash
# Set your API key
export API_KEY="nxak_your_copied_key_here"

# Test authentication
curl -X GET "https://your-domain.com/api/chat/conversations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json"

# Expected: 200 OK with conversations list
# Expected: 401 Unauthorized if key is invalid
```

### Test 3: Test Scope Permissions

```bash
# Test with read:chat scope (should work)
curl -X GET "https://your-domain.com/api/chat/conversations" \
  -H "Authorization: Bearer $API_KEY"

# Test with write:chat scope (should work)
curl -X POST "https://your-domain.com/api/chat/conversations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test via API Key"}'

# Test without proper scope (should fail with 403 Forbidden)
# If your key doesn't have write:documents scope
curl -X POST "https://your-domain.com/api/chat/upload-document" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@test.pdf"

# Expected: 403 Forbidden - "Missing required scope"
```

### Test 4: Test Rate Limiting

```bash
# Send 100 requests rapidly (should hit rate limit)
for i in {1..100}; do
  curl -X GET "https://your-domain.com/api/chat/conversations" \
    -H "Authorization: Bearer $API_KEY" \
    -s -o /dev/null -w "%{http_code}\n"
done

# Expected: First 60 requests return 200 OK
# Expected: Requests 61+ return 429 Too Many Requests
```

### Test 5: Revoke API Key

1. Navigate to: `https://your-domain.com/dashboard/settings/api-keys`
2. Find your test key in the table
3. Click the shield icon (revoke)
4. Confirm the action
5. **Expected Result**:
   - Toast notification "API key revoked"
   - Status badge changes to "Revoked"
   - Key no longer works in API requests

```bash
# Verify revoked key doesn't work
curl -X GET "https://your-domain.com/api/chat/conversations" \
  -H "Authorization: Bearer $API_KEY"

# Expected: 401 Unauthorized - "API key has been revoked"
```

### Test 6: View Usage Statistics

1. Navigate to: `https://your-domain.com/dashboard/settings/api-keys`
2. Check the "Usage" column in the table
3. **Expected Result**:
   - Shows total requests count
   - Shows success/error breakdown
   - Shows average response time

---

## Cost Tracking Testing

### Test 1: Generate AI Usage

```bash
# Create a new conversation
curl -X POST "https://your-domain.com/api/chat/conversations" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cost Tracking Test",
    "model": "gpt-4o",
    "provider": "openai",
    "systemPromptId": null
  }'

# Save the conversation ID from response
export CONVERSATION_ID="returned_conversation_id"

# Send multiple messages to generate costs
curl -X POST "https://your-domain.com/api/chat/conversations/$CONVERSATION_ID/stream" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing in detail",
    "model": "gpt-4o",
    "provider": "openai"
  }'

# Repeat with different messages
curl -X POST "https://your-domain.com/api/chat/conversations/$CONVERSATION_ID/stream" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the meaning of life?",
    "model": "gpt-4o",
    "provider": "openai"
  }'
```

### Test 2: Check Cost Analytics UI

1. Navigate to: `https://your-domain.com/dashboard/analytics`
2. Click the "Costos de IA" or "AI Costs" tab
3. **Expected Result**:
   - Summary cards show:
     - Total Spend (USD)
     - Total Requests
     - Total Tokens (millions)
     - Average Cost per Request
   - Charts display:
     - Daily spend bar chart
     - Provider distribution pie chart
   - Table shows costs by model

### Test 3: Set Budget and Test Alerts

```bash
# Set a low budget to trigger alerts
curl -X PUT "https://your-domain.com/api/team/cost-analytics" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyBudgetUsd": 1,
    "alertThresholdPercentage": 50
  }'

# Expected: 200 OK - "Cost settings updated"
```

1. Navigate to: `https://your-domain.com/dashboard/analytics` → "Costos de IA"
2. **Expected Result**:
   - Budget section shows: "$1.00 / $1.00" (100%)
   - Progress bar is red (exceeded)
   - Alert banner appears at top

### Test 4: Test Alert Dismissal

```bash
# Get current analytics to find alert ID
curl -X GET "https://your-domain.com/api/team/cost-analytics?days=30" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Dismiss the alert
curl -X POST "https://your-domain.com/api/team/cost-analytics" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert_uuid_from_previous_response"
  }'

# Expected: 200 OK - "Alert dismissed"
```

### Test 5: Verify Database Records

```sql
-- Check if usage logs are being created
SELECT
  provider,
  model,
  request_tokens,
  response_tokens,
  total_cost_usd,
  features_used,
  created_at
FROM projectnexus.ai_usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- Check cost settings
SELECT
  team_slug,
  monthly_budget_usd,
  alert_threshold_percentage,
  current_monthly_spend_usd
FROM projectnexus.ai_cost_settings;

-- Check budget alerts
SELECT
  alert_type,
  percentage_used,
  created_at,
  dismissed_at
FROM projectnexus.ai_budget_alerts
ORDER BY created_at DESC;

-- Calculate total spend for verification
SELECT
  provider,
  model,
  SUM(total_cost_usd) as total_spend,
  COUNT(*) as request_count,
  SUM(request_tokens) as total_input_tokens,
  SUM(response_tokens) as total_output_tokens
FROM projectnexus.ai_usage_logs
GROUP BY provider, model
ORDER BY total_spend DESC;
```

### Test 6: Test Cost Calculation Accuracy

```bash
# Query cost analytics via API
curl -X GET "https://your-domain.com/api/team/cost-analytics?days=30" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" | jq '.analytics'

# Manually verify calculations:
# GPT-4o pricing: $0.005/1M input tokens, $0.015/1M output tokens
# Example: 1000 input + 500 output tokens
# Input cost: (1000 / 1,000,000) * 0.005 = $0.000005
# Output cost: (500 / 1,000,000) * 0.015 = $0.0000075
# Total: $0.0000125

# Compare API response with manual calculation
```

---

## Verification Checklist

### API Keys System

- [ ] Migration 011 completed successfully
- [ ] `team_api_keys` table exists
- [ ] `team_api_key_usage` table exists
- [ ] Can create API key via UI
- [ ] API key format is correct (`nxak_` + 32 chars)
- [ ] API key is only shown once
- [ ] Can validate API key via API
- [ ] Scopes are enforced correctly
- [ ] Rate limiting works (60/min, 1000/hour)
- [ ] Can revoke API key
- [ ] Can delete API key permanently
- [ ] Usage statistics are tracked
- [ ] Expired keys are rejected
- [ ] Audit logs are created

### Cost Tracking System

- [ ] Migration 012 completed successfully
- [ ] `ai_usage_logs` table exists
- [ ] `ai_cost_settings` table exists
- [ ] `ai_budget_alerts` table exists
- [ ] Usage is logged after each chat response
- [ ] Token counting is reasonably accurate
- [ ] Cost calculations are correct
- [ ] Multiple providers are tracked
- [ ] Features used (RAG, web search, etc.) are logged
- [ ] Analytics UI displays data correctly
- [ ] Budget can be set via UI
- [ ] Budget progress bar shows correct percentage
- [ ] Alerts are triggered at threshold
- [ ] Alerts can be dismissed
- [ ] Color coding works (green/yellow/red)

### Audit Logs

- [ ] Migration 013 completed successfully
- [ ] `team_audit_logs` table exists
- [ ] API key creation is logged
- [ ] API key deletion is logged
- [ ] Cost settings changes are logged
- [ ] Logs include user email
- [ ] Logs include timestamp
- [ ] Logs include action details

---

## Troubleshooting

### Migration Errors

**Error**: `relation "projectnexus.team_api_keys" does not exist`
- **Cause**: Migration 011 didn't run
- **Fix**: Re-run migration 011

**Error**: `foreign key constraint "fk_api_key_usage" cannot be implemented`
- **Cause**: Migrations run out of order
- **Fix**: Drop tables and re-run migrations in order (011 → 012 → 013)

```sql
-- Drop tables if needed
DROP TABLE IF EXISTS projectnexus.team_audit_logs CASCADE;
DROP TABLE IF EXISTS projectnexus.ai_budget_alerts CASCADE;
DROP TABLE IF EXISTS projectnexus.ai_cost_settings CASCADE;
DROP TABLE IF EXISTS projectnexus.ai_usage_logs CASCADE;
DROP TABLE IF EXISTS projectnexus.team_api_key_usage CASCADE;
DROP TABLE IF EXISTS projectnexus.team_api_keys CASCADE;
```

### API Key Issues

**Error**: API key returns 401 Unauthorized
- **Possible causes**:
  1. Key was copied incorrectly (missing characters)
  2. Key was revoked
  3. Key expired
  4. Database connection issue

**Debug**:
```sql
-- Check if key exists and is active
SELECT id, name, is_active, expires_at, last_used_at
FROM projectnexus.team_api_keys
WHERE key_prefix = 'nxak_first_8_chars';

-- Check usage logs for errors
SELECT endpoint, status_code, response_time_ms, created_at
FROM projectnexus.team_api_key_usage
ORDER BY created_at DESC
LIMIT 20;
```

### Cost Tracking Issues

**Error**: No data showing in analytics dashboard

**Debug**:
```sql
-- Check if logs exist
SELECT COUNT(*) FROM projectnexus.ai_usage_logs;

-- Check recent logs
SELECT * FROM projectnexus.ai_usage_logs
ORDER BY created_at DESC
LIMIT 5;

-- Check for errors in application logs
# Terminal: tail -f logs/app.log | grep "cost-tracker"
```

**Error**: Costs seem incorrect

**Debug**:
```sql
-- Verify pricing calculations
SELECT
  model,
  request_tokens,
  response_tokens,
  input_cost_usd,
  output_cost_usd,
  total_cost_usd,
  -- Expected calculation
  (request_tokens::NUMERIC / 1000000.0 *
    CASE model
      WHEN 'gpt-4o' THEN 0.005
      WHEN 'gpt-4o-mini' THEN 0.00015
      WHEN 'claude-3-5-sonnet-20241022' THEN 0.003
      ELSE 0.001
    END
  ) as expected_input_cost
FROM projectnexus.ai_usage_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Performance Issues

**Issue**: Slow query on analytics page

**Solution**: Check if indexes exist
```sql
-- Verify indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'projectnexus'
  AND tablename IN ('ai_usage_logs', 'team_api_key_usage');

-- If missing, recreate them
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_team_created
  ON projectnexus.ai_usage_logs(team_slug, created_at DESC);
```

### Rate Limiting Not Working

**Debug**:
```sql
-- Check rate limit settings
SELECT name, rate_limit_per_minute, rate_limit_per_hour
FROM projectnexus.team_api_keys;

-- Check recent usage count
SELECT
  api_key_id,
  COUNT(*) as request_count,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request
FROM projectnexus.team_api_key_usage
WHERE created_at > NOW() - INTERVAL '1 minute'
GROUP BY api_key_id;
```

---

## Rollback Procedure

If you need to rollback the changes:

```sql
-- Drop all new tables
DROP TABLE IF EXISTS projectnexus.team_audit_logs CASCADE;
DROP TABLE IF EXISTS projectnexus.ai_budget_alerts CASCADE;
DROP TABLE IF EXISTS projectnexus.ai_cost_settings CASCADE;
DROP TABLE IF EXISTS projectnexus.ai_usage_logs CASCADE;
DROP TABLE IF EXISTS projectnexus.team_api_key_usage CASCADE;
DROP TABLE IF EXISTS projectnexus.team_api_keys CASCADE;

-- Restore from backup if needed
psql -U your_user -h your_host -d projectnexus < backup_before_phases5-7_YYYYMMDD.sql
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All tests pass in staging environment
- [ ] Database backup created
- [ ] Migration scripts tested in staging
- [ ] API keys documentation reviewed
- [ ] Cost tracking pricing verified
- [ ] Budget alerts configured for production team
- [ ] Monitoring dashboards set up
- [ ] Rollback procedure documented
- [ ] Team training completed

---

## Additional Resources

- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY_PHASES_5_7.md`
- **API Documentation**: See inline comments in route files
- **Translation Keys**: See `messages/es.json` and `messages/en.json`

---

**Last Updated**: January 4, 2026
**Phases**: 5, 6, 7
**Status**: Ready for Testing

# TASK 6: OIDC API Routes - Testing Guide

This document provides comprehensive testing procedures for the OIDC API routes implementation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Manual Testing](#manual-testing)
5. [Database Verification](#database-verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before testing, ensure you have:

- ✅ PostgreSQL database running with `projectnexus` schema
- ✅ Node.js 18+ and npm installed
- ✅ Authentik instance configured with OAuth2/OIDC provider
- ✅ Feature flags enabled in environment variables

---

## Environment Setup

### 1. Set Environment Variables

Create or update your `.env.local` file:

```bash
# Authentik Configuration
AUTHENTIK_ISSUER="https://ak.mokka-dev.de/application/o/nexary-enterprise/"
AUTHENTIK_CLIENT_ID="your-client-id"
AUTHENTIK_CLIENT_SECRET="your-client-secret"

# Redirect URIs
AUTHENTIK_REDIRECT_URI="http://localhost:3000/api/oidc/callback"

# Feature Flags - Enable for testing
FEATURE_FLAG_OIDC_ENABLED="true"
FEATURE_FLAG_OIDC_CANARY_PERCENT="100"  # 100% for testing

# Database (use your existing config)
DATABASE_URL="postgresql://user:password@localhost:5432/projectnexus"

# Stack Auth (use your existing config)
NEXT_PUBLIC_STACK_PROJECT_ID="your-project-id"
STACK_SECRET_KEY="your-secret-key"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The server should start at `http://localhost:3000`.

---

## Database Setup

### 1. Create Test Team

```sql
-- Insert a test team
INSERT INTO projectnexus.teams (id, name, slug, description)
VALUES (
  gen_random_uuid(),
  'Test Enterprise Team',
  'test-enterprise',
  'Team for OIDC testing'
)
ON CONFLICT (slug) DO NOTHING;
```

### 2. Configure OIDC for Test Team

```sql
-- Insert OIDC configuration for the test team
INSERT INTO projectnexus.oidc_configurations (
  team_slug,
  issuer_url,
  client_id,
  client_secret,
  scopes,
  response_type,
  prompt,
  pkce,
  claim_mappings
)
VALUES (
  'test-enterprise',
  'https://ak.mokka-dev.de/application/o/nexary-enterprise/',
  'your-client-id',
  'your-client-secret',
  ARRAY['openid', 'email', 'profile'],
  'code',
  'login',
  true,
  '{"email": "email", "name": "name"}'::jsonb
)
ON CONFLICT (team_slug) DO UPDATE
SET issuer_url = EXCLUDED.issuer_url,
    client_id = EXCLUDED.client_id,
    client_secret = EXCLUDED.client_secret,
    scopes = EXCLUDED.scopes,
    updated_at = NOW();
```

---

## Manual Testing

### Test 1: Initiate OIDC Login

**Endpoint**: `POST /api/oidc/[teamSlug]/login`

**Request**:

```bash
curl -X POST http://localhost:3000/api/oidc/test-enterprise/login \
  -H "Content-Type: application/json" \
  -d '{
    "returnUrl": "/dashboard"
  }'
```

**Expected Success Response** (200 OK):

```json
{
  "authUrl": "https://ak.mokka-dev.de/application/o/authorize?client_id=...&response_type=code&scope=openid+email+profile&state=...&nonce=...&code_challenge=...&code_challenge_method=S256&prompt=login",
  "state": "random_state_value_here"
}
```

**Expected Error Response** (403 Forbidden - OIDC disabled):

```json
{
  "error": "OIDC authentication is not enabled for this team"
}
```

**Expected Error Response** (404 Not Found - No config):

```json
{
  "error": "OIDC configuration not found for this team"
}
```

### Test 2: Simulate Callback (After Login)

**Note**: This test requires completing the actual login flow in a browser.

1. **Copy the `authUrl` from Test 1** and open it in a browser.
2. **Complete the login** at the Authentik identity provider.
3. **You will be redirected** back to the callback endpoint with the authorization code.

**Callback URL format**:

```
http://localhost:3000/api/oidc/callback?code=AUTHORIZATION_CODE&state=STATE_VALUE
```

**Expected Behavior**:

- If successful: Redirects to `/dashboard` (or your returnUrl)
- If error: Redirects to `/login?error=ERROR_CODE`

### Test 3: Test with Invalid State

**Request**:

```bash
curl "http://localhost:3000/api/oidc/callback?code=test&state=invalid_state"
```

**Expected Behavior**: Redirects to `/login?error=invalid_session`

### Test 4: Test with Expired Session

1. Initiate login with Test 1
2. Wait 15 minutes for session to expire
3. Try to complete the callback

**Expected Behavior**: Redirects to `/login?error=session_expired`

### Test 5: Logout

**Endpoint**: `POST /api/oidc/logout`

**Request**:

```bash
curl -X POST http://localhost:3000/api/oidc/logout \
  -H "Content-Type: application/json" \
  -d '{
    "teamSlug": "test-enterprise",
    "postLogoutRedirectUri": "/login"
  }'
```

**Expected Success Response** (200 OK):

```json
{
  "logoutUrl": "https://ak.mokka-dev.de/application/o/...?post_logout_redirect_uri=..."
}
```

**Expected Response** (No logout endpoint available):

```json
{
  "message": "Logged out locally",
  "postLogoutRedirectUri": "/login"
}
```

---

## Database Verification

### Verify OIDC Session Created

```sql
-- Check if session was created after login initiation
SELECT
  id,
  state,
  team_slug,
  return_url,
  expires_at,
  created_at,
  ip_address,
  user_agent
FROM projectnexus.oidc_sessions
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Output**: One or more rows with session data.

### Verify Audit Logs

```sql
-- Check audit logs for authentication flow
SELECT
  id,
  team_slug,
  user_id,
  flow_id,
  event_type,
  status,
  error_code,
  error_description,
  ip_address,
  user_agent,
  created_at
FROM projectnexus.oidc_audit_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Output**:
- `redirect_start` event with status `success`
- `callback_received` event with status `success`
- `token_exchange` event with status `success`
- `user_linked` event with status `success`

### Verify User Identity Linked

```sql
-- Check if user identity was linked
SELECT
  id,
  user_id,
  team_slug,
  provider,
  issuer,
  subject,
  email,
  name,
  connected_at,
  last_seen_at
FROM projectnexus.user_identities
WHERE provider = 'oidc'
ORDER BY connected_at DESC;
```

**Expected Output**: User identity record with provider `'oidc'`.

### Verify Configuration Last Used

```sql
-- Check if last_used_at was updated
SELECT
  team_slug,
  issuer_url,
  client_id,
  last_used_at,
  updated_at
FROM projectnexus.oidc_configurations
WHERE team_slug = 'test-enterprise';
```

**Expected Output**: `last_used_at` should be recent (within last hour).

---

## Troubleshooting

### Issue: "OIDC not enabled for this team"

**Solution**:

1. Check feature flags:
   ```sql
   SELECT * FROM projectnexus.feature_flags WHERE flag LIKE '%oidc%';
   ```

2. Enable via environment variables:
   ```bash
   FEATURE_FLAG_OIDC_ENABLED="true"
   FEATURE_FLAG_OIDC_CANARY_PERCENT="100"
   ```

3. Restart the development server.

### Issue: "OIDC configuration not found"

**Solution**:

1. Verify configuration exists:
   ```sql
   SELECT * FROM projectnexus.oidc_configurations WHERE team_slug = 'test-enterprise';
   ```

2. If missing, create it using the setup SQL above.

### Issue: "Invalid or expired session"

**Solution**:

1. Check session expiration:
   ```sql
   SELECT
     state,
     expires_at,
     NOW() as current_time,
     expires_at > NOW() as is_valid
   FROM projectnexus.oidc_sessions
   ORDER BY created_at DESC
   LIMIT 5;
   ```

2. If expired, initiate a new login flow.

### Issue: Token exchange fails

**Solution**:

1. Check Authentik configuration:
   - Verify client ID and secret are correct
   - Verify redirect URI matches Authentik configuration
   - Check Authentik logs for errors

2. Check OIDC provider logs:
   ```bash
   # In your terminal, look for structured log output
   # Search for: "Failed to exchange code for tokens"
   ```

3. Verify network connectivity to Authentik:
   ```bash
   curl -I https://ak.mokka-dev.de/application/o/nexary-enterprise/
   ```

### Issue: User not created after successful authentication

**Solution**:

1. Check if identity was created:
   ```sql
   SELECT * FROM projectnexus.user_identities WHERE email = 'user@example.com';
   ```

2. Check audit logs for errors:
   ```sql
   SELECT * FROM projectnexus.oidc_audit_logs
   WHERE event_type = 'user_linked'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. Verify Stack Auth integration is configured correctly.

---

## Security Validation Checklist

### State Parameter (CSRF Protection)

- ✅ State is generated randomly for each login
- ✅ State is verified on callback
- ✅ Invalid state returns error

### PKCE (Code Interception Protection)

- ✅ Code verifier is generated and stored
- ✅ Code challenge is sent to Authentik
- ✅ Code verifier is used in token exchange

### Session Security

- ✅ Sessions expire after 15 minutes
- ✅ Expired sessions are rejected
- ✅ Sessions are single-use (deleted after callback)

### Audit Logging

- ✅ All authentication events are logged
- ✅ IP address and user agent are captured
- ✅ Error codes and descriptions are recorded

---

## Performance Testing

### Load Test Login Endpoint

```bash
# Install apache bench if needed
# macOS: brew install httpd
# Ubuntu: sudo apt-get install apache2-utils

# Run 100 requests with 10 concurrent connections
ab -n 100 -c 10 -p login_payload.json -T application/json \
  http://localhost:3000/api/oidc/test-enterprise/login
```

**File**: `login_payload.json`

```json
{
  "returnUrl": "/dashboard"
}
```

**Expected Results**:
- All requests should complete successfully
- Response time should be < 500ms
- No database connection errors

---

## Next Steps

After successful testing:

1. ✅ **TASK 7**: Implement Unified Auth Router
   - Route to SAML or OIDC based on team configuration
   - Provide single endpoint for all authentication

2. ✅ **Frontend Integration**
   - Add OIDC login button to login page
   - Handle OIDC callback in frontend

3. ✅ **Production Deployment**
   - Configure production Authentik instance
   - Update redirect URIs for production domain
   - Enable feature flags for production rollout

---

## Additional Resources

- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Authentik Documentation](https://goauthentik.io/docs/)
- [Project Context`../../.claude/plans/task-6-oidc-api-routes-context.md`

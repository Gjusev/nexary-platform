# GDPR Compliance Documentation

## Overview

Nexary is designed to comply with the General Data Protection Regulation (GDPR) for processing personal data of European Union residents. This document outlines Nexary's GDPR compliance framework, implementation, and operational procedures.

## GDPR Principles Implementation

### 1. Lawfulness, Fairness, and Transparency

**Implementation**:
- Clear privacy policy explaining data processing
- Granular consent mechanisms for data collection
- Transparent data usage documentation
- User-friendly privacy dashboard

**Technical Evidence**:
```sql
-- Consent records stored in consent_records table
SELECT * FROM consent_records WHERE user_id = 'user-uuid';

-- Consent tracking per processing purpose
{
  "purpose": "chat_conversation_storage",
  "consent": true,
  "timestamp": "2025-01-01T12:00:00Z",
  "ip_address": "192.168.1.1",
  "metadata": {
    "privacy_policy_version": "2.1",
    "ui_context": "onboarding_flow"
  }
}
```

### 2. Purpose Limitation

**Implementation**:
- Data collected for specific, explicit purposes
- No secondary use without additional consent
- Purpose mapping in database schema
- Regular audits of data usage

**Data Purposes**:
| Purpose | Description | Legal Basis | Retention |
|---------|-------------|-------------|-----------|
| Authentication | User login, session management | Contract performance | Account lifetime |
| Chat Services | AI conversation storage | Contract performance | User-controlled |
| RAG Processing | Document text extraction | Contract performance | Package lifetime |
| Analytics | Usage metrics, improvement | Legitimate interest | 12 months |
| Marketing | Product updates, promotions | Consent | Until withdrawal |

### 3. Data Minimization

**Implementation**:
- Only collect necessary data
- Anonymization for analytics
- Data masking in logs
- Minimal PII storage

**Example - Chat Message Storage**:
```typescript
// Before: Storing all metadata
{
  "user_id": "uuid",
  "content": "message text",
  "ip_address": "192.168.1.1",  // Unnecessary
  "user_agent": "Chrome/120.0", // Unnecessary
  "location": "Frankfurt"      // Unnecessary
}

// After: Minimized data
{
  "user_id": "uuid",
  "content": "message text",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### 4. Accuracy

**Implementation**:
- User can edit/delete their data
- Regular data validation
- Correction API endpoints
- Audit trail for data changes

**API Endpoints**:
```typescript
// User data correction
PUT /api/users/profile
{
  "displayName": "Correct Name",
  "email": "correct@email.com"
}

// Chat message editing
PUT /api/chat/messages/{id}
{
  "content": "Corrected message"
}
```

### 5. Storage Limitation

**Implementation**:
- Configurable retention policies
- Automated data deletion
- User-controlled deletion
- Anonymization after retention period

**Retention Configuration**:
```typescript
// lib/retention.ts
export const retentionPolicies = {
  chat_messages: {
    default: 365, // days
    user_override: true
  },
  audit_logs: {
    default: 2555, // 7 years (legal requirement)
    user_override: false
  },
  analytics: {
    default: 365, // 1 year
    anonymize_after: 90 // days
  }
};
```

### 6. Integrity and Confidentiality

**Implementation**:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Access controls and authentication
- Regular security audits
- Penetration testing

**Security Measures**:
```typescript
// Data encryption
import { encrypt, decrypt } from '@/lib/crypto';

// Encrypt sensitive data before storage
const encryptedPII = encrypt(user.email, process.env.ENCRYPTION_KEY);

// Access logging
await db.query(`
  INSERT INTO audit_logs (user_id, action, resource, ip_address)
  VALUES ($1, 'access_pii', 'user_profile', $2)
`, [userId, ipAddress]);
```

### 7. Accountability

**Implementation**:
- Comprehensive audit logging
- Data Protection Impact Assessments (DPIA)
- Data Protection Officer (DPO) designation
- Regular compliance audits
- Documentation of all processing activities

## Data Subject Rights

### Right to Information (Articles 13 & 14)

**Implementation**: Privacy Policy and Notice

```markdown
**Privacy Policy** (at account creation and updates)

# Data We Collect

1. **Account Information**
   - Name, email address
   - Collected when: Registration
   - Purpose: Account management, authentication

2. **Chat Content**
   - Message content, metadata
   - Collected when: Using chat features
   - Purpose: Service delivery, conversation history

3. **Usage Data**
   - Feature usage, preferences
   - Collected when: Using the platform
   - Purpose: Service improvement

# Legal Basis
- Contract performance (for service delivery)
- Consent (for optional features)
- Legitimate interest (for security, fraud prevention)
```

### Right to Access (Article 15)

**API Endpoint**: `POST /api/gdpr/data-access`

**Implementation**:
```typescript
// app/api/gdpr/data-access/route.ts
export async function POST(req: Request) {
  const userId = await getUserId(req);

  // Collect all user data
  const userData = {
    personal: await db.query('SELECT * FROM users WHERE id = $1', [userId]),
    conversations: await db.query('SELECT * FROM chat_conversations WHERE user_id = $1', [userId]),
    messages: await db.query('SELECT * FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = $1)', [userId]),
    team_memberships: await db.query('SELECT * FROM team_members WHERE user_id = $1', [userId]),
    consents: await db.query('SELECT * FROM consent_records WHERE user_id = $1', [userId]),
    audit_logs: await db.query('SELECT * FROM audit_logs WHERE user_id = $1', [userId]),
  };

  // Generate machine-readable export
  const exportData = {
    export_date: new Date().toISOString(),
    user_id: userId,
    data: userData,
    format_version: "1.0"
  };

  // Store export and notify user
  const exportId = await storeExport(exportData);
  await notifyUser(userId, 'data_export_ready', { exportId });

  return Response.json({ requestId: exportId });
}
```

**Response Format**:
```json
{
  "requestId": "gdpr-request-uuid",
  "status": "processing",
  "estimated_completion": "2025-01-01T14:00:00Z",
  "delivery_method": "secure_download"
}
```

### Right to Rectification (Article 16)

**API Endpoint**: `PUT /api/users/profile`, `PUT /api/chat/messages/{id}`

**Implementation**:
```typescript
// Allow users to correct their data
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  const messageId = params.id;

  // Verify ownership
  const message = await db.query(
    'SELECT * FROM chat_messages WHERE id = $1 AND conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = $2)',
    [messageId, userId]
  );

  if (!message) {
    return new Response('Not found or unauthorized', { status: 404 });
  }

  // Update with audit trail
  await db.query(`
    UPDATE chat_messages
    SET content = $1, updated_at = NOW()
    WHERE id = $2
  `, [req.body.content, messageId]);

  // Log the change
  await logDataChange({
    user_id: userId,
    table: 'chat_messages',
    record_id: messageId,
    action: 'rectification',
    old_value: message.content,
    new_value: req.body.content
  });

  return Response.json({ success: true });
}
```

### Right to Erasure (Right to be Forgotten) (Article 17)

**API Endpoint**: `POST /api/gdpr/data-delete`

**Implementation**:
```typescript
// app/api/gdpr/data-delete/route.ts
export async function POST(req: Request) {
  const userId = await getUserId(req);

  // Create deletion request
  const requestId = await db.query(`
    INSERT INTO gdpr_requests (user_id, request_type, status)
    VALUES ($1, 'erasure', 'pending')
    RETURNING id
  `, [userId]);

  // Queue deletion job
  await queueJob('gdpr_erasure', { userId, requestId });

  // Check for legal holds
  const legalHolds = await checkLegalHolds(userId);
  if (legalHolds.length > 0) {
    await db.query(`
      UPDATE gdpr_requests
      SET status = 'blocked',
          metadata = $1
      WHERE id = $2
    `, [JSON.stringify({ legal_holds: legalHolds }), requestId]);

    return Response.json({
      requestId,
      status: 'blocked',
      reason: 'legal_hold',
      legal_holds: legalHolds
    });
  }

  return Response.json({
    requestId,
    status: 'processing',
    estimated_completion: '2025-01-01T14:00:00Z'
  });
}

// Deletion job
async function executeErasure(userId: string) {
  // Delete chat messages
  await db.query('DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = $1)', [userId]);

  // Delete conversations
  await db.query('DELETE FROM chat_conversations WHERE user_id = $1', [userId]);

  // Delete team memberships (or anonymize if required)
  await db.query('DELETE FROM team_members WHERE user_id = $1', [userId]);

  // Delete user account
  await db.query('DELETE FROM users WHERE id = $1', [userId]);

  // Keep consent records (legal requirement)
  await db.query('UPDATE consent_records SET user_id = NULL WHERE user_id = $1', [userId]);

  // Keep audit logs (anonymized)
  await db.query('UPDATE audit_logs SET user_id = \'ANONYMIZED-\' || substr($1::text, 1, 8) WHERE user_id = $1', [userId]);
}
```

### Right to Restrict Processing (Article 18)

**API Endpoint**: `POST /api/gdpr/restrict-processing`

**Implementation**:
```typescript
// Add processing restriction flag
await db.query(`
  UPDATE users
  SET processing_restricted = true,
      restriction_reason = $1,
      restricted_at = NOW()
  WHERE id = $2
`, [reason, userId]);

// Enforce restriction in data processing
function canProcessData(userId: string) {
  const user = await getUser(userId);
  if (user.processing_restricted) {
    throw new Error('Processing restricted for this user');
  }
  return true;
}
```

### Right to Data Portability (Article 20)

**API Endpoint**: `GET /api/gdpr/data-export`

**Implementation**:
```typescript
// app/api/gdpr/data-export/route.ts
export async function GET(req: Request) {
  const userId = await getUserId(req);

  // Collect all data in machine-readable format
  const exportData = {
    export_date: new Date().toISOString(),
    user_id: userId,
    format: "json",
    version: "1.0",
    data: {
      profile: await getUserProfile(userId),
      conversations: await getConversations(userId),
      messages: await getMessages(userId),
      teams: await getTeamMemberships(userId),
      documents: await getDocuments(userId),
      consents: await getConsents(userId)
    }
  };

  // Generate downloadable file
  const fileName = `nexary-export-${userId}-${Date.now()}.json`;
  const signedUrl = await generatePresignedUrl(fileName);

  await uploadToStorage(fileName, JSON.stringify(exportData, null, 2));

  return Response.json({
    download_url: signedUrl,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    size: JSON.stringify(exportData).length
  });
}
```

### Right to Object (Article 21)

**API Endpoint**: `POST /api/gdpr/object`

**Implementation**:
```typescript
// Object to processing based on legitimate interest
await db.query(`
  INSERT INTO data_processing_objections (user_id, objection_type, created_at)
  VALUES ($1, 'legitimate_interest', NOW())
`, [userId]);

// Check objections before processing
if (await hasObjection(userId, 'legitimate_interest')) {
  // Stop processing and implement alternative
  return null;
}
```

## Data Protection Impact Assessment (DPIA)

### High-Risk Processing Activities

Nexary conducts DPIAs for:

1. **AI-powered chat processing**
   - Risk: Processing sensitive personal data in conversations
   - Mitigation: Data minimization, encryption, user control

2. **RAG document processing**
   - Risk: Processing documents containing personal data
   - Mitigation: User consent, content scanning, access controls

3. **Behavioral analytics**
   - Risk: Profiling users based on usage patterns
   - Mitigation: Anonymization, opt-out mechanisms

### DPIA Template

```markdown
# Data Protection Impact Assessment

## Project: [Project Name]
**Date**: [Date]
**DPO**: [DPO Name]
**Version**: 1.0

## 1. Processing Description
- What personal data is being processed?
- What is the purpose of processing?
- Who has access to the data?
- How long is data retained?

## 2. Necessity and Proportionality
- Why is this processing necessary?
- Are there less intrusive alternatives?
- Is the data proportionate to the purpose?

## 3. Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data breach | Medium | High | Encryption, access controls |
| Unauthorized access | Low | High | Authentication, auditing |
| Data loss | Low | Medium | Backups, redundancy |

## 4. Compliance Measures
- [ ] Lawfulness, fairness, transparency
- [ ] Purpose limitation
- [ ] Data minimization
- [ ] Accuracy
- [ ] Storage limitation
- [ ] Integrity and confidentiality

## 5. Conclusion
- [] Proceed with processing
- [] Implement additional measures
- [] Consult supervisory authority

**Approved by**: [DPO Signature]
**Date**: [Date]
```

## Data Breach Management

### Detection and Notification

```typescript
// Data breach detection and logging
async function detectDataBreach(event: any) {
  const breach = {
    id: generateUUID(),
    detected_at: new Date(),
    type: categorizeBreach(event),
    severity: assessSeverity(event),
    affected_users: await identifyAffectedUsers(event),
    data_types: identifyDataTypes(event),
    mitigation_steps: []
  };

  // Log in audit system
  await db.query('INSERT INTO data_breaches VALUES ($1)', [breach]);

  // Notify DPO within 24 hours
  if (breach.severity === 'high') {
    await notifyDPO(breach);
  }

  return breach;
}

// Notify supervisory authority within 72 hours
async function notifyAuthority(breach: any) {
  const notification = {
    breach_id: breach.id,
    notification_time: new Date(),
    description: breach.description,
    categories: breach.data_types,
    affected_count: breach.affected_users.length,
    mitigation: breach.mitigation_steps,
    contact_point: 'dpo@nexary.ai'
  };

  await sendToDPA(notification);
}
```

## International Data Transfers

### SCCs (Standard Contractual Clauses)

Nexary uses SCCs for international data transfers:

```typescript
// International transfer logging
await logInternationalTransfer({
  user_id: userId,
  data_type: 'chat_messages',
  destination_country: 'United States',
  legal_basis: 'SCC',
  scc_version: '2021-09-01',
  safeguards: 'Encryption, contractual clauses'
});
```

## Ongoing Compliance

### Regular Audits

```typescript
// Automated compliance checks
async function runComplianceAudit() {
  const results = {
    consent_records: await checkConsentCompliance(),
    data_retention: await checkRetentionPolicy(),
    access_controls: await checkAccessControls(),
    encryption: await checkEncryption(),
    breach_detection: await checkBreachDetection()
  };

  await generateComplianceReport(results);
}

// Quarterly compliance review
async function quarterlyReview() {
  // Review all processing activities
  const processingActivities = await listProcessingActivities();

  // Check if DPIAs are up to date
  for (const activity of processingActivities) {
    if (activity.requires_dpia && !activity.has_current_dpia) {
      await scheduleDPIA(activity);
    }
  }

  // Update ROPA (Record of Processing Activities)
  await updateROPA();
}
```

### Staff Training

- GDPR awareness training for all employees
- Role-specific training for developers, support, sales
- Annual refresher courses
- Training completion tracked in HR system

## Documentation

### Records of Processing Activities (ROPA)

```typescript
// ROPA entry
{
  "processing_activity": "AI Chat Processing",
  "purpose": "Provide AI-powered conversation services",
  "data_categories": ["User profile", "Chat content", "Metadata"],
  "recipients": ["AI providers", "Database administrators"],
  "international_transfers": ["OpenAI (US)", "Google (US)"],
  "retention_period": "User-controlled or 12 months inactive",
  "security_measures": ["Encryption", "Access controls", "Audit logging"],
  "legal_basis": "Contract performance"
}
```

## Contact

**Data Protection Officer**: dpo@nexary.ai
**GDPR Inquiries**: privacy@nexary.ai
**Data Breach Reporting**: breach@nexary.ai

---

*Last updated: January 2025*
*Next review: July 2025*

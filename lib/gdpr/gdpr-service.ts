/**
 * GDPR Compliance Service
 *
 * Implements GDPR (General Data Protection Regulation) requirements:
 * - Article 15: Right of Access
 * - Article 17: Right to Erasure (Right to be Forgotten)
 * - Article 20: Right to Data Portability
 * - Article 7: Conditions for Consent
 *
 * Regulation (EU) 2016/679
 */

import { query } from '@/lib/db';

// =====================================================
// TYPES
// =====================================================

export interface UserDataExport {
  userId: string;
  email: string | null;
  profile: {
    displayName: string | null;
    createdAt: string;
    lastLogin: string | null;
  };
  teamMemberships: TeamMembershipData[];
  chatConversations: ChatConversationData[];
  uploadedDocuments: DocumentData[];
  apiKeys: ApiKeyData[];
  auditLogs: AuditLogEntry[];
  consents: ConsentRecord[];
  metadata: {
    exportedAt: string;
    format: 'GDPR-JSON-v1';
    regulations: ['GDPR Article 15', 'GDPR Article 20'];
  };
}

export interface TeamMembershipData {
  teamSlug: string;
  teamName: string | null;
  role: string | null;
  status: string;
  joinedAt: string;
}

export interface ChatConversationData {
  conversationId: string;
  teamSlug: string | null;
  messageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
}

export interface DocumentData {
  documentId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  ragPackageId: string | null;
}

export interface ApiKeyData {
  keyId: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ConsentRecord {
  consentType: string;
  granted: boolean;
  grantedAt: string;
  withdrawnAt: string | null;
  version: string;
}

export interface GDPRRequest {
  id: string;
  userId: string;
  requestType: 'access' | 'erasure' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string;
}

export interface ConsentData {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

export type ConsentType =
  | 'marketing'
  | 'analytics'
  | 'cookies'
  | 'third_party_sharing'
  | 'email_communications';

// =====================================================
// DATA ACCESS (Article 15)
// =====================================================

/**
 * Export all user data for GDPR Right of Access request
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  // Get basic user profile from Stack Auth
  const profileResult = await query(
    `SELECT DISTINCT ON (user_id) user_id, MIN(created_at) as created_at
     FROM audit_logs
     WHERE actor_user_id = $1
     GROUP BY user_id`,
    [userId]
  );

  const lastLoginResult = await query(
    `SELECT created_at
     FROM audit_logs
     WHERE actor_user_id = $1 AND action = 'USER_LOGIN'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  // Get team memberships
  const teamMemberships = await query(
    `SELECT tm.team_id, t.slug as team_slug, t.name as display_name, tm.role, tm.status, tm.created_at
     FROM projectnexus.team_members tm
     JOIN projectnexus.teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1`,
    [userId]
  );

  // Get chat conversations summary
  const chatConversations = await query(
    `SELECT cc.id, cc.team_slug,
            COUNT(cm.id) as message_count,
            MIN(cm.created_at) as first_message_at,
            MAX(cm.created_at) as last_message_at
     FROM projectnexus.chat_conversations cc
     LEFT JOIN projectnexus.chat_messages cm ON cm.conversation_id = cc.id
     WHERE cc.user_id = $1
     GROUP BY cc.id`,
    [userId]
  );

  // Get uploaded documents
  const documents = await query(
    `SELECT rd.id, rd.file_name, rd.file_size, rd.created_at, rd.package_id
     FROM projectnexus.rag_documents rd
     WHERE rd.uploaded_by = $1`,
    [userId]
  );

  // Get API keys
  const apiKeys = await query(
    `SELECT id, name, key_prefix, scopes, created_at, last_used
     FROM projectnexus.api_keys
     WHERE user_id = $1`,
    [userId]
  );

  // Get audit logs
  const auditLogs = await query(
    `SELECT id, action, target_type, target_id, ip_address, created_at
     FROM projectnexus.audit_logs
     WHERE actor_user_id = $1
     ORDER BY created_at DESC
     LIMIT 1000`,
    [userId]
  );

  // Get consent records
  const consents = await query(
    `SELECT consent_type, granted, granted_at, withdrawn_at, consent_version
     FROM projectnexus.consent_records
     WHERE user_id = $1
     ORDER BY granted_at DESC`,
    [userId]
  );

  return {
    userId,
    email: profileResult.rows[0]?.user_id || null,
    profile: {
      displayName: profileResult.rows[0]?.user_id || null,
      createdAt: profileResult.rows[0]?.created_at || new Date().toISOString(),
      lastLogin: lastLoginResult.rows[0]?.created_at || null,
    },
    teamMemberships: teamMemberships.rows.map((row) => ({
      teamSlug: row.team_slug,
      teamName: row.display_name,
      role: row.role,
      status: row.status,
      joinedAt: row.created_at,
    })),
    chatConversations: chatConversations.rows.map((row) => ({
      conversationId: row.id,
      teamSlug: row.team_slug,
      messageCount: parseInt(row.message_count) || 0,
      firstMessageAt: row.first_message_at,
      lastMessageAt: row.last_message_at,
    })),
    uploadedDocuments: documents.rows.map((row) => ({
      documentId: row.id,
      fileName: row.file_name,
      fileSize: parseInt(row.file_size) || 0,
      uploadedAt: row.created_at,
      ragPackageId: row.package_id,
    })),
    apiKeys: apiKeys.rows.map((row) => ({
      keyId: row.id,
      name: row.name,
      prefix: row.key_prefix,
      scopes: row.scopes || [],
      createdAt: row.created_at,
      lastUsed: row.last_used,
    })),
    auditLogs: auditLogs.rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    })),
    consents: consents.rows.map((row) => ({
      consentType: row.consent_type,
      granted: row.granted,
      grantedAt: row.granted_at,
      withdrawnAt: row.withdrawn_at,
      version: row.consent_version,
    })),
    metadata: {
      exportedAt: new Date().toISOString(),
      format: 'GDPR-JSON-v1',
      regulations: ['GDPR Article 15', 'GDPR Article 20'],
    },
  };
}

// =====================================================
// DATA ERASURE (Article 17)
// =====================================================

/**
 * Anonymize user data for GDPR Right to Erasure request
 *
 * Note: Complete deletion is not always possible due to:
 * - Legal requirements (tax, accounting)
 * - Public interest grounds
 * - Exercise of freedom of expression
 *
 * This function performs soft deletion and anonymization.
 */
export async function anonymizeUserData(
  userId: string,
  reason: 'user_request' | 'account_deletion' | 'gdpr_erasure'
): Promise<{ deleted: number; anonymized: number }> {
  const anonymizedId = `anon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const anonymizedEmail = `anonymized-${anonymizedId}@deleted.local`;

  let deleted = 0;
  let anonymized = 0;

  try {
    // 1. Anonymize audit logs (keep for security/compliance, but anonymize user reference)
    await query(
      `UPDATE projectnexus.audit_logs
       SET actor_user_id = $1
       WHERE actor_user_id = $2`,
      [anonymizedId, userId]
    );
    anonymized += 1;

    // 2. Delete API keys
    const apiKeyResult = await query(
      `DELETE FROM projectnexus.api_keys WHERE user_id = $1 RETURNING id`,
      [userId]
    );
    deleted += apiKeyResult.rowCount || 0;

    // 3. Anonymize chat conversations and messages
    await query(
      `UPDATE projectnexus.chat_conversations
       SET user_id = $1
       WHERE user_id = $2`,
      [anonymizedId, userId]
    );
    anonymized += 1;

    await query(
      `UPDATE projectnexus.chat_messages
       SET user_id = $1
       WHERE user_id = $2`,
      [anonymizedId, userId]
    );
    anonymized += 1;

    // 4. Anonymize uploaded documents
    await query(
      `UPDATE projectnexus.rag_documents
       SET uploaded_by = $1
       WHERE uploaded_by = $2`,
      [anonymizedId, userId]
    );
    anonymized += 1;

    // 5. Soft delete team memberships (keep record for audit)
    await query(
      `UPDATE projectnexus.team_members
       SET status = 'deleted', removed_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    anonymized += 1;

    // 6. Delete consent records (no longer needed)
    const consentResult = await query(
      `DELETE FROM projectnexus.consent_records WHERE user_id = $1 RETURNING id`,
      [userId]
    );
    deleted += consentResult.rowCount || 0;

    // 7. Log the erasure
    await query(
      `INSERT INTO projectnexus.audit_logs (id, team_slug, actor_user_id, action, metadata, created_at)
       VALUES (gen_random_uuid(), NULL, $1, 'GDPR_DATA_ERASURE', $2, NOW())`,
      [
        anonymizedId,
        JSON.stringify({
          originalUserId: userId,
          reason,
          anonymizedId,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return { deleted, anonymized };
  } catch (error) {
    console.error('GDPR erasure error:', error);
    throw error;
  }
}

/**
 * Check if user data can be erased (validates constraints)
 */
export async function canEraseUserData(userId: string): Promise<{
  canErase: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];

  // Check if user is sole owner of active teams
  const teamCheck = await query(
    `SELECT tm.team_id, t.slug as team_slug, t.name as display_name
     FROM projectnexus.team_members tm
     JOIN projectnexus.teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1
       AND tm.role = 'team-owner'
       AND tm.status = 'active'
       AND (SELECT COUNT(*) FROM projectnexus.team_members WHERE team_id = tm.team_id AND role = 'team-owner' AND status = 'active') = 1`,
    [userId]
  );

  if (teamCheck.rows.length > 0) {
    reasons.push(
      `User is sole owner of ${teamCheck.rows.length} active team(s): ${teamCheck.rows.map((r) => r.display_name || r.team_slug).join(', ')}`
    );
  }

  // Check for pending legal requests (placeholder - would integrate with legal hold system)
  // const legalHoldCheck = await checkLegalHolds(userId);
  // if (legalHoldCheck.hasHold) {
  //   reasons.push('User data is subject to a legal hold');
  // }

  return {
    canErase: reasons.length === 0,
    reasons,
  };
}

// =====================================================
// DATA PORTABILITY (Article 20)
// =====================================================

/**
 * Export user data in portable, machine-readable format
 *
 * Returns data in JSON format that can be:
 * - Transmitted to another data controller
 * - Used by the data subject themselves
 * - Structured, commonly used, and machine-readable
 */
export async function exportPortableData(userId: string): Promise<{
  json: string;
  csv?: string;
}> {
  const userData = await exportUserData(userId);

  // JSON export (structured format)
  const json = JSON.stringify(userData, null, 2);

  // CSV export (flat format for common tools)
  const csvRows: string[] = [];

  // Flatten nested data for CSV
  for (const membership of userData.teamMemberships) {
    csvRows.push(
      [
        'team_membership',
        userData.email,
        membership.teamSlug,
        membership.teamName,
        membership.role,
        membership.status,
        membership.joinedAt,
      ].join(',')
    );
  }

  for (const doc of userData.uploadedDocuments) {
    csvRows.push(
      [
        'document',
        userData.email,
        doc.documentId,
        doc.fileName,
        doc.fileSize.toString(),
        doc.uploadedAt,
      ].join(',')
    );
  }

  const csv = [
    'data_type,user_email,identifier,name,size,role,status,created_at',
    ...csvRows,
  ].join('\n');

  return { json, csv };
}

// =====================================================
// CONSENT MANAGEMENT (Article 7)
// =====================================================

/**
 * Record user consent
 */
export async function recordConsent(data: ConsentData): Promise<void> {
  const currentVersion = '1.0';

  await query(
    `INSERT INTO projectnexus.consent_records (
      id, user_id, consent_type, granted, granted_at, consent_version, ip_address, user_agent
    ) VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, $5, $6)`,
    [data.userId, data.consentType, data.granted, currentVersion, data.ipAddress, data.userAgent]
  );

  // Log consent for audit trail
  await query(
    `INSERT INTO projectnexus.audit_logs (id, team_slug, actor_user_id, action, metadata, created_at)
     VALUES (gen_random_uuid(), NULL, $1, 'CONSENT_RECORDED', $2, NOW())`,
    [data.userId, JSON.stringify({ consentType: data.consentType, granted: data.granted })]
  );
}

/**
 * Withdraw user consent
 */
export async function withdrawConsent(
  userId: string,
  consentType: ConsentType,
  ipAddress?: string
): Promise<void> {
  await query(
    `UPDATE projectnexus.consent_records
     SET withdrawn_at = NOW()
     WHERE user_id = $1 AND consent_type = $2 AND withdrawn_at IS NULL`,
    [userId, consentType]
  );

  // Log consent withdrawal
  await query(
    `INSERT INTO projectnexus.audit_logs (id, team_slug, actor_user_id, action, metadata, created_at)
     VALUES (gen_random_uuid(), NULL, $1, 'CONSENT_WITHDRAWN', $2, NOW())`,
    [userId, JSON.stringify({ consentType, ipAddress })]
  );
}

/**
 * Get user's current consent status
 */
export async function getUserConsents(userId: string): Promise<ConsentRecord[]> {
  const result = await query(
    `SELECT consent_type, granted, granted_at, withdrawn_at, consent_version as version
     FROM projectnexus.consent_records
     WHERE user_id = $1
     ORDER BY granted_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    consentType: row.consent_type,
    granted: row.granted,
    grantedAt: row.granted_at,
    withdrawnAt: row.withdrawn_at,
    version: row.version,
  }));
}

/**
 * Check if user has given specific consent
 */
export async function hasConsent(
  userId: string,
  consentType: ConsentType
): Promise<boolean> {
  const result = await query(
    `SELECT granted
     FROM projectnexus.consent_records
     WHERE user_id = $1 AND consent_type = $2 AND withdrawn_at IS NULL
     ORDER BY granted_at DESC
     LIMIT 1`,
    [userId, consentType]
  );

  return result.rows.length > 0 ? result.rows[0].granted : false;
}

// =====================================================
// GDPR REQUEST MANAGEMENT
// =====================================================

/**
 * Create a GDPR data request
 */
export async function createGDPRRequest(
  userId: string,
  requestType: 'access' | 'erasure' | 'portability'
): Promise<GDPRRequest> {
  const result = await query(
    `INSERT INTO projectnexus.gdpr_requests (id, user_id, request_type, status, requested_at, expires_at)
     VALUES (gen_random_uuid(), $1, $2, 'pending', NOW(), NOW() + INTERVAL '30 days')
     RETURNING *`,
    [userId, requestType]
  );

  // Log the request
  await query(
    `INSERT INTO projectnexus.audit_logs (id, team_slug, actor_user_id, action, metadata, created_at)
     VALUES (gen_random_uuid(), NULL, $1, 'GDPR_REQUEST_CREATED', $2, NOW())`,
    [userId, JSON.stringify({ requestType, requestId: result.rows[0].id })]
  );

  return result.rows[0];
}

/**
 * Get GDPR request by ID
 */
export async function getGDPRRequest(requestId: string): Promise<GDPRRequest | null> {
  const result = await query(
    `SELECT * FROM projectnexus.gdpr_requests WHERE id = $1`,
    [requestId]
  );

  return result.rows[0] || null;
}

/**
 * Get user's GDPR requests
 */
export async function getUserGDPRRequests(userId: string): Promise<GDPRRequest[]> {
  const result = await query(
    `SELECT * FROM projectnexus.gdpr_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Process GDPR request (mark as completed)
 */
export async function processGDPRRequest(
  requestId: string,
  status: 'completed' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  await query(
    `UPDATE projectnexus.gdpr_requests
     SET status = $1, processed_at = NOW(), rejection_reason = $2
     WHERE id = $3`,
    [status, rejectionReason || null, requestId]
  );
}

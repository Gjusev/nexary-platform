/**
 * eDiscovery Service
 *
 * Provides advanced search and export capabilities for legal discovery,
 * compliance audits, and internal investigations.
 *
 * Features:
 * - Full-text search across conversations, documents, and logs
 * - Date range filtering
 * - User and team filtering
 * - Export to PDF and ZIP formats
 * - Audit trail for all discovery requests
 */

import { query } from '@/lib/db';

// =====================================================
// TYPES
// =====================================================

export interface EDiscoverySearchParams {
  query: string;
  teamSlug?: string;
  resourceTypes: ResourceType[];
  startDate?: Date;
  endDate?: Date;
  users?: string[];
  limit?: number;
  offset?: number;
}

export type ResourceType = 'chat_messages' | 'documents' | 'audit_logs' | 'consents' | 'api_keys';

export interface EDiscoveryResult {
  type: ResourceType;
  id: string;
  teamSlug?: string;
  userId?: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
  relevance?: number;
}

export interface EDiscoveryExport {
  searchId: string;
  totalResults: number;
  results: EDiscoveryResult[];
  query: EDiscoverySearchParams;
  exportedAt: Date;
  format: 'json' | 'csv' | 'pdf' | 'zip';
}

export interface EDiscoverySummary {
  totalDocuments: number;
  documentsByType: Record<ResourceType, number>;
  dateRange: { earliest: Date; latest: Date };
  uniqueUsers: number;
  uniqueTeams: number;
}

// =====================================================
// SEARCH FUNCTIONS
// =====================================================

/**
 * Perform eDiscovery search across all resources
 */
export async function searchEDiscovery(params: EDiscoverySearchParams): Promise<{
  results: EDiscoveryResult[];
  summary: EDiscoverySummary;
  hasMore: boolean;
}> {
  const {
    query,
    teamSlug,
    resourceTypes,
    startDate,
    endDate,
    users,
    limit = 100,
    offset = 0,
  } = params;

  const results: EDiscoveryResult[] = [];
  const documentsByType: Record<ResourceType, number> = {
    chat_messages: 0,
    documents: 0,
    audit_logs: 0,
    consents: 0,
    api_keys: 0,
  };

  // Search in each resource type
  if (resourceTypes.includes('chat_messages')) {
    const chatResults = await searchChatMessages({ query, teamSlug, startDate, endDate, users, limit, offset });
    results.push(...chatResults);
    documentsByType.chat_messages += chatResults.length;
  }

  if (resourceTypes.includes('documents')) {
    const docResults = await searchDocuments({ query, teamSlug, startDate, endDate, users, limit, offset });
    results.push(...docResults);
    documentsByType.documents += docResults.length;
  }

  if (resourceTypes.includes('audit_logs')) {
    const auditResults = await searchAuditLogs({ query, teamSlug, startDate, endDate, users, limit, offset });
    results.push(...auditResults);
    documentsByType.audit_logs += auditResults.length;
  }

  if (resourceTypes.includes('consents')) {
    const consentResults = await searchConsents({ query, teamSlug, startDate, endDate, users, limit, offset });
    results.push(...consentResults);
    documentsByType.consents += consentResults.length;
  }

  if (resourceTypes.includes('api_keys')) {
    const apiKeyResults = await searchAPIKeys({ query, teamSlug, startDate, endDate, users, limit, offset });
    results.push(...apiKeyResults);
    documentsByType.api_keys += apiKeyResults.length;
  }

  // Get summary statistics
  const summary = await getDiscoverySummary(teamSlug, resourceTypes);

  return {
    results: results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit),
    summary,
    hasMore: results.length > limit,
  };
}

/**
 * Search chat messages
 */
async function searchChatMessages(params: {
  query: string;
  teamSlug?: string;
  startDate?: Date;
  endDate?: Date;
  users?: string[];
  limit?: number;
  offset?: number;
}): Promise<EDiscoveryResult[]> {
  const { query: searchQuery, teamSlug, startDate, endDate, users, limit = 100, offset = 0 } = params;

  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  // Full-text search query
  if (searchQuery) {
    conditions.push(`cm.content ILIKE $${paramIndex++}`);
    queryParams.push(`%${searchQuery}%`);
  }

  // Date range
  if (startDate) {
    conditions.push(`cm.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    conditions.push(`cm.created_at <= $${paramIndex++}`);
    queryParams.push(endDate);
  }

  // Team filter
  if (teamSlug) {
    conditions.push(`cc.team_slug = $${paramIndex++}`);
    queryParams.push(teamSlug);
  }

  // User filter
  if (users && users.length > 0) {
    conditions.push(`cm.user_id = ANY($${paramIndex++})`);
    queryParams.push(users);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      cm.id,
      cm.user_id,
      cm.content,
      cm.created_at,
      cc.team_slug
    FROM projectnexus.chat_messages cm
    JOIN projectnexus.chat_conversations cc ON cm.conversation_id = cc.id
    ${whereClause}
    ORDER BY cm.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...queryParams, limit, offset]
  );

  return result.rows.map((row) => ({
    type: 'chat_messages' as ResourceType,
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    content: row.content,
    metadata: {
      conversationId: row.conversation_id,
    },
    timestamp: row.created_at,
  }));
}

/**
 * Search RAG documents
 */
async function searchDocuments(params: {
  query: string;
  teamSlug?: string;
  startDate?: Date;
  endDate?: Date;
  users?: string[];
  limit?: number;
  offset?: number;
}): Promise<EDiscoveryResult[]> {
  const { query: searchQuery, teamSlug, startDate, endDate, users, limit = 100, offset = 0 } = params;

  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (searchQuery) {
    conditions.push(`(rd.title ILIKE $${paramIndex++} OR rd.content_summary ILIKE $${paramIndex++})`);
    queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (startDate) {
    conditions.push(`rd.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    conditions.push(`rd.created_at <= $${paramIndex++}`);
    queryParams.push(endDate);
  }

  if (teamSlug) {
    conditions.push(`rd.team_slug = $${paramIndex++}`);
    queryParams.push(teamSlug);
  }

  if (users && users.length > 0) {
    conditions.push(`rd.uploaded_by = ANY($${paramIndex++})`);
    queryParams.push(users);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      rd.id,
      rd.team_slug,
      rd.title,
      rd.content_summary,
      rd.uploaded_by,
      rd.created_at
    FROM projectnexus.rag_documents rd
    ${whereClause}
    ORDER BY rd.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...queryParams, limit, offset]
  );

  return result.rows.map((row) => ({
    type: 'documents' as ResourceType,
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.uploaded_by,
    content: `${row.title}: ${row.content_summary || ''}`,
    metadata: {
      title: row.title,
    },
    timestamp: row.created_at,
  }));
}

/**
 * Search audit logs
 */
async function searchAuditLogs(params: {
  query: string;
  teamSlug?: string;
  startDate?: Date;
  endDate?: Date;
  users?: string[];
  limit?: number;
  offset?: number;
}): Promise<EDiscoveryResult[]> {
  const { query: searchQuery, teamSlug, startDate, endDate, users, limit = 100, offset = 0 } = params;

  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (searchQuery) {
    conditions.push(`(al.action ILIKE $${paramIndex++} OR al.metadata::text ILIKE $${paramIndex++})`);
    queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (startDate) {
    conditions.push(`al.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    conditions.push(`al.created_at <= $${paramIndex++}`);
    queryParams.push(endDate);
  }

  if (teamSlug) {
    conditions.push(`al.team_slug = $${paramIndex++}`);
    queryParams.push(teamSlug);
  }

  if (users && users.length > 0) {
    conditions.push(`al.actor_user_id = ANY($${paramIndex++})`);
    queryParams.push(users);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      al.id,
      al.team_slug,
      al.actor_user_id,
      al.action,
      al.metadata,
      al.created_at
    FROM projectnexus.audit_logs al
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...queryParams, limit, offset]
  );

  return result.rows.map((row) => ({
    type: 'audit_logs' as ResourceType,
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.actor_user_id,
    content: `${row.action}: ${JSON.stringify(row.metadata)}`,
    metadata: {
      action: row.action,
    },
    timestamp: row.created_at,
  }));
}

/**
 * Search consent records
 */
async function searchConsents(params: {
  query: string;
  teamSlug?: string;
  startDate?: Date;
  endDate?: Date;
  users?: string[];
  limit?: number;
  offset?: number;
}): Promise<EDiscoveryResult[]> {
  const { query: searchQuery, teamSlug, startDate, endDate, users, limit = 100, offset = 0 } = params;

  // Note: consent_records may not exist in all schemas, so we search where applicable
  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (searchQuery) {
    conditions.push(`cr.user_id ILIKE $${paramIndex++}`);
    queryParams.push(`%${searchQuery}%`);
  }

  if (startDate) {
    conditions.push(`cr.granted_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    conditions.push(`cr.granted_at <= $${paramIndex++}`);
    queryParams.push(endDate);
  }

  if (users && users.length > 0) {
    conditions.push(`cr.user_id = ANY($${paramIndex++})`);
    queryParams.push(users);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      cr.id,
      cr.user_id,
      cr.consent_type,
      cr.granted,
      cr.granted_at,
      cr.metadata
    FROM projectnexus.consent_records cr
    ${whereClause}
    ORDER BY cr.granted_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...queryParams, limit, offset]
  );

  return result.rows.map((row) => ({
    type: 'consents' as ResourceType,
    id: row.id,
    userId: row.user_id,
    content: `${row.consent_type}: ${row.granted ? 'Granted' : 'Revoked'}`,
    metadata: {
      consentType: row.consent_type,
      granted: row.granted,
    },
    timestamp: row.granted_at,
  }));
}

/**
 * Search API keys
 */
async function searchAPIKeys(params: {
  query: string;
  teamSlug?: string;
  startDate?: Date;
  endDate?: Date;
  users?: string[];
  limit?: number;
  offset?: number;
}): Promise<EDiscoveryResult[]> {
  const { query: searchQuery, teamSlug, startDate, endDate, users, limit = 100, offset = 0 } = params;

  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (searchQuery) {
    conditions.push(`(ak.name ILIKE $${paramIndex++} OR ak.key_prefix ILIKE $${paramIndex++})`);
    queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (startDate) {
    conditions.push(`ak.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    conditions.push(`ak.created_at <= $${paramIndex++}`);
    queryParams.push(endDate);
  }

  if (teamSlug) {
    conditions.push(`ak.team_slug = $${paramIndex++}`);
    queryParams.push(teamSlug);
  }

  if (users && users.length > 0) {
    conditions.push(`ak.created_by = ANY($${paramIndex++})`);
    queryParams.push(users);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      ak.id,
      ak.team_slug,
      ak.name,
      ak.key_prefix,
      ak.scopes,
      ak.created_by,
      ak.created_at
    FROM projectnexus.api_keys ak
    ${whereClause}
    ORDER BY ak.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...queryParams, limit, offset]
  );

  return result.rows.map((row) => ({
    type: 'api_keys' as ResourceType,
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.created_by,
    content: `${row.name}: ${row.key_prefix}***`,
    metadata: {
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
    },
    timestamp: row.created_at,
  }));
}

// =====================================================
// SUMMARY FUNCTIONS
// =====================================================

/**
 * Get eDiscovery summary statistics
 */
async function getDiscoverySummary(
  teamSlug?: string,
  resourceTypes?: ResourceType[]
): Promise<EDiscoverySummary> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (teamSlug) {
    // For each resource type, we need to check separately
  }

  // Get date range from all resources
  const dateResult = await query(`
    SELECT
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM (
      SELECT created_at FROM projectnexus.chat_messages
      ${teamSlug ? `WHERE conversation_id IN (SELECT id FROM projectnexus.chat_conversations WHERE team_slug = $1)` : ''}
      UNION ALL
      SELECT created_at FROM projectnexus.rag_documents
      ${teamSlug ? `WHERE team_slug = $1` : ''}
      UNION ALL
      SELECT created_at FROM projectnexus.audit_logs
      ${teamSlug ? `WHERE team_slug = $1` : ''}
    ) as all_dates
  ${teamSlug ? `WHERE $1 IS NOT NULL` : ''}
  `, teamSlug ? [teamSlug, teamSlug, teamSlug] : []);

  const earliest = dateResult.rows[0]?.earliest || new Date();
  const latest = dateResult.rows[0]?.latest || new Date();

  // Count documents by type
  const documentsByType: Record<ResourceType, number> = {
    chat_messages: 0,
    documents: 0,
    audit_logs: 0,
    consents: 0,
    api_keys: 0,
  };

  if (!resourceTypes || resourceTypes.includes('chat_messages')) {
    const chatCount = await query(
      `SELECT COUNT(*) as count FROM projectnexus.chat_messages cm
       JOIN projectnexus.chat_conversations cc ON cm.conversation_id = cc.id
       ${teamSlug ? `WHERE cc.team_slug = $1` : ''}`,
      teamSlug ? [teamSlug] : []
    );
    documentsByType.chat_messages = parseInt(chatCount.rows[0].count);
  }

  if (!resourceTypes || resourceTypes.includes('documents')) {
    const docCount = await query(
      `SELECT COUNT(*) as count FROM projectnexus.rag_documents
       ${teamSlug ? `WHERE team_slug = $1` : ''}`,
      teamSlug ? [teamSlug] : []
    );
    documentsByType.documents = parseInt(docCount.rows[0].count);
  }

  if (!resourceTypes || resourceTypes.includes('audit_logs')) {
    const auditCount = await query(
      `SELECT COUNT(*) as count FROM projectnexus.audit_logs
       ${teamSlug ? `WHERE team_slug = $1` : ''}`,
      teamSlug ? [teamSlug] : []
    );
    documentsByType.audit_logs = parseInt(auditCount.rows[0].count);
  }

  const totalDocuments = Object.values(documentsByType).reduce((sum, count) => sum + count, 0);

  // Get unique users and teams
  const usersResult = await query(`
    SELECT COUNT(DISTINCT user_id) as count
    FROM (
      SELECT user_id FROM projectnexus.chat_messages
      UNION
      SELECT uploaded_by as user_id FROM projectnexus.rag_documents
      UNION
      SELECT actor_user_id as user_id FROM projectnexus.audit_logs
    ) as all_users
  `);

  const uniqueUsers = parseInt(usersResult.rows[0].count);

  const teamsResult = await query(`
    SELECT COUNT(DISTINCT slug) as count
    FROM projectnexus.teams
    ${teamSlug ? `WHERE slug = $1` : ''}
  `, teamSlug ? [teamSlug] : []);

  const uniqueTeams = parseInt(teamsResult.rows[0].count);

  return {
    totalDocuments,
    documentsByType,
    dateRange: { earliest, latest },
    uniqueUsers,
    uniqueTeams,
  };
}

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

/**
 * Export eDiscovery results to JSON
 */
export async function exportToJSON(results: EDiscoveryResult[]): Promise<string> {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalResults: results.length,
    results: results.map((r) => ({
      ...r,
      timestamp: r.timestamp.toISOString(),
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export eDiscovery results to CSV
 */
export async function exportToCSV(results: EDiscoveryResult[]): Promise<string> {
  if (results.length === 0) {
    return 'No results found';
  }

  const headers = ['Type', 'ID', 'Team Slug', 'User ID', 'Content', 'Timestamp', 'Metadata'];
  const rows = results.map((r) => [
    r.type,
    r.id,
    r.teamSlug || '',
    r.userId || '',
    `"${r.content.replace(/"/g, '""')}"`,
    r.timestamp.toISOString(),
    `"${JSON.stringify(r.metadata).replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Log eDiscovery request for audit
 */
export async function logEDiscoveryRequest(params: {
  teamSlug?: string;
  userId?: string;
  queryParams: EDiscoverySearchParams;
  resultsCount: number;
  ipAddress?: string;
}): Promise<void> {
  await query(
    `INSERT INTO projectnexus.audit_logs (id, team_slug, actor_user_id, action, target_type, metadata, created_at)
     VALUES (gen_random_uuid(), $1, $2, 'EDISCOVERY_SEARCH', 'ediscovery', $3, NOW())`,
    [
      params.teamSlug || null,
      params.userId || null,
      JSON.stringify({
        queryParams: params.queryParams,
        resultsCount: params.resultsCount,
        ipAddress: params.ipAddress,
      }),
    ]
  );
}

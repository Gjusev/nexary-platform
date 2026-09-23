/**
 * Database optimization utilities.
 *
 * Provides functions for creating indexes, analyzing query performance,
 * and managing materialized views for analytics.
 */

import { pool, query } from '@/lib/db';

// ============================================================================
// Additional Indexes for Performance
// ============================================================================

/**
 * Create additional indexes for commonly queried patterns.
 * These indexes complement the existing ones in the main schema.
 */
export async function createOptimizedIndexes(): Promise<void> {
  const indexes = [
    // Chat conversations - frequently filtered by user and team
    `CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_team_updated
     ON projectnexus.chat_conversations(user_email, team_slug, updated_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_chat_conversations_team_updated
     ON projectnexus.chat_conversations(team_slug, updated_at DESC) WHERE updated_at > NOW() - INTERVAL '30 days'`,

    // Chat messages - time-series queries for pagination
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
     ON projectnexus.chat_messages(conversation_id, created_at DESC)`,

    // RAG documents - active documents filtering
    `CREATE INDEX IF NOT EXISTS idx_rag_documents_package_active
     ON projectnexus.rag_documents(package_id, uploaded_at DESC) WHERE deleted_at IS NULL`,

    `CREATE INDEX IF NOT EXISTS idx_rag_documents_package_chunks
     ON projectnexus.rag_documents(package_id, chunk_count)`,

    // Team members - active members lookup
    `CREATE INDEX IF NOT EXISTS idx_team_members_team_role_active
     ON projectnexus.team_members(team_id, role, status) WHERE status = 'active'`,

    `CREATE INDEX IF NOT EXISTS idx_team_members_user_last_active
     ON projectnexus.team_members(user_id, last_active DESC)`,

    // Audit logs - time-series queries with filters
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_team_time
     ON projectnexus.audit_logs(team_slug, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time
     ON projectnexus.audit_logs(action, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
     ON projectnexus.audit_logs(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL`,

    // Usage events - analytics queries
    `CREATE INDEX IF NOT EXISTS idx_usage_events_team_type_time
     ON projectnexus.usage_events(team_slug, event_type, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_usage_events_user_time
     ON projectnexus.usage_events(user_id, created_at DESC) WHERE user_id IS NOT NULL`,

    // Chat embeddings - vector similarity search optimization
    `CREATE INDEX IF NOT EXISTS idx_chat_embeddings_document_chunk
     ON projectnexus.chat_embeddings(document_id, chunk_index)`,

    // API keys - active keys lookup
    `CREATE INDEX IF NOT EXISTS idx_api_keys_team_active
     ON projectnexus.api_keys(team_slug, created_at DESC) WHERE (expires_at IS NULL OR expires_at > NOW())`,

    // GDPR requests - pending/processing queue
    `CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status_queue
     ON projectnexus.gdpr_requests(status, requested_at) WHERE status IN ('pending', 'processing')`,

    // Retention jobs - scheduled jobs queue
    `CREATE INDEX IF NOT EXISTS idx_retention_jobs_queue
     ON projectnexus.retention_jobs(status, scheduled_for) WHERE status IN ('pending', 'in_progress')`,

    // Consent records - active consents
    `CREATE INDEX IF NOT EXISTS idx_consent_user_type_active
     ON projectnexus.consent_records(user_id, consent_type) WHERE withdrawn_at IS NULL`,

    // SCIM sync logs - recent syncs
    `CREATE INDEX IF NOT EXISTS idx_scim_sync_team_status
     ON projectnexus.scim_sync_logs(team_slug, created_at DESC) WHERE status = 'failed'`,

    // SAML audit logs - failed authentication attempts
    `CREATE INDEX IF NOT EXISTS idx_saml_audit_failed
     ON projectnexus.saml_audit_logs(team_slug, created_at DESC) WHERE status IN ('failed', 'denied')`,

    // PHI access logs - recent access for compliance
    `CREATE INDEX IF NOT EXISTS idx_phi_access_recent
     ON projectnexus.phi_access_logs(team_slug, created_at DESC) WHERE created_at > NOW() - INTERVAL '90 days'`,
  ];

  for (const indexSql of indexes) {
    try {
      await pool.query(indexSql);
    } catch (error) {
      console.error(`Failed to create index: ${(error as Error).message}`);
    }
  }

  }

// ============================================================================
// Materialized Views for Analytics
// ============================================================================

/**
 * Create materialized views for common analytics queries.
 * These views should be refreshed periodically.
 */
export async function createMaterializedViews(): Promise<void> {
  // Team usage summary
  await pool.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS projectnexus.mv_team_usage_summary AS
    SELECT
      t.slug AS team_slug,
      t.name AS team_name,
      COUNT(DISTINCT tm.user_id) AS member_count,
      COUNT(DISTINCT tm.user_id) FILTER (WHERE tm.role = 'team-owner') AS owner_count,
      COUNT(DISTINCT tm.user_id) FILTER (WHERE tm.role = 'team-leader') AS leader_count,
      COUNT(DISTINCT rp.id) AS rag_package_count,
      COUNT(DISTINCT rd.id) FILTER (WHERE rd.deleted_at IS NULL) AS document_count,
      COUNT(DISTINCT cc.id) AS conversation_count,
      COUNT(DISTINCT ue.id) AS usage_event_count,
      MAX(tm.last_active) AS last_team_activity,
      NOW() AS refreshed_at
    FROM projectnexus.teams t
    LEFT JOIN projectnexus.team_members tm ON tm.team_id = t.id AND tm.status = 'active'
    LEFT JOIN projectnexus.rag_packages rp ON rp.team_slug = t.slug AND rp.deleted_at IS NULL
    LEFT JOIN projectnexus.rag_documents rd ON rd.package_id = rp.id
    LEFT JOIN projectnexus.chat_conversations cc ON cc.team_slug = t.slug
    LEFT JOIN projectnexus.usage_events ue ON ue.team_slug = t.slug AND ue.created_at > NOW() - INTERVAL '30 days'
    GROUP BY t.id, t.slug, t.name
  `);

  // Daily usage metrics
  await pool.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS projectnexus.mv_daily_usage_metrics AS
    SELECT
      team_slug,
      DATE(created_at) AS metric_date,
      event_type,
      COUNT(*) AS event_count,
      COUNT(DISTINCT user_id) AS unique_users,
      COUNT(DISTINCT rag_id) AS rag_packages_used
    FROM projectnexus.usage_events
    WHERE created_at > NOW() - INTERVAL '90 days'
    GROUP BY team_slug, DATE(created_at), event_type
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_daily_usage_team_date
    ON projectnexus.mv_daily_usage_metrics(team_slug, metric_date DESC)
  `);

  // Audit log summary
  await pool.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS projectnexus.mv_audit_summary AS
    SELECT
      team_slug,
      DATE(created_at) AS audit_date,
      action,
      COUNT(*) AS action_count,
      COUNT(DISTINCT actor_user_id) AS unique_actors,
      COUNT(*) FILTER (WHERE target_type IS NOT NULL) AS with_target
    FROM projectnexus.audit_logs
    WHERE created_at > NOW() - INTERVAL '90 days'
    GROUP BY team_slug, DATE(created_at), action
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_audit_summary_team_date
    ON projectnexus.mv_audit_summary(team_slug, audit_date DESC)
  `);

  // RAG package statistics
  await pool.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS projectnexus.mv_rag_package_stats AS
    SELECT
      rp.id AS package_id,
      rp.team_slug,
      rp.name AS package_name,
      COUNT(DISTINCT rd.id) FILTER (WHERE rd.deleted_at IS NULL) AS document_count,
      SUM(rd.chunk_count) FILTER (WHERE rd.deleted_at IS NULL) AS total_chunks,
      SUM(rd.size) FILTER (WHERE rd.deleted_at IS NULL) AS total_size_bytes,
      MAX(rd.uploaded_at) AS last_document_upload,
      COUNT(DISTINCT ue.id) AS query_count,
      MAX(ue.created_at) AS last_query_at,
      NOW() AS refreshed_at
    FROM projectnexus.rag_packages rp
    LEFT JOIN projectnexus.rag_documents rd ON rd.package_id = rp.id
    LEFT JOIN projectnexus.usage_events ue ON ue.rag_id = rp.id AND ue.event_type = 'rag_query' AND ue.created_at > NOW() - INTERVAL '30 days'
    WHERE rp.deleted_at IS NULL
    GROUP BY rp.id, rp.team_slug, rp.name
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_rag_stats_team
    ON projectnexus.mv_rag_package_stats(team_slug)
  `);

  }

/**
 * Refresh all materialized views concurrently.
 * Should be run periodically (e.g., every hour or daily).
 */
export async function refreshMaterializedViews(): Promise<void> {
  const views = [
    'projectnexus.mv_team_usage_summary',
    'projectnexus.mv_daily_usage_metrics',
    'projectnexus.mv_audit_summary',
    'projectnexus.mv_rag_package_stats',
  ];

  await Promise.all(
    views.map(view => pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`))
  );

  }

// ============================================================================
// Query Performance Analysis
// ============================================================================

/**
 * Analyze slow queries from pg_stat_statements.
 * Requires pg_stat_statements extension to be enabled.
 */
export async function analyzeSlowQueries(limit: number = 20): Promise<any[]> {
  try {
    // Ensure extension is enabled
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);

    const result = await pool.query(`
      SELECT
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time,
        stddev_exec_time,
        rows
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  } catch (error) {
    console.error('Failed to analyze slow queries:', error);
    return [];
  }
}

/**
 * Get table sizes and row counts for storage analysis.
 */
export async function getTableStats(): Promise<any[]> {
  const result = await pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
      pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
      n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'projectnexus'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `);

  return result.rows;
}

/**
 * Get index usage statistics to find unused indexes.
 */
export async function getIndexUsage(): Promise<any[]> {
  const result = await pool.query(`
    SELECT
      schemaname,
      tablename,
      indexname,
      idx_scan AS index_scans,
      idx_tup_read AS tuples_read,
      idx_tup_fetch AS tuples_fetched,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'projectnexus'
    ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
  `);

  return result.rows;
}

/**
 * Analyze a specific query using EXPLAIN ANALYZE.
 */
export async function explainQuery(sql: string, params?: any[]): Promise<string> {
  const result = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  return JSON.stringify(result.rows[0], null, 2);
}

// ============================================================================
// Database Maintenance
// ============================================================================

/**
 * Run ANALYZE on all tables to update statistics.
 * This helps the query planner make better decisions.
 */
export async function analyzeTables(): Promise<void> {
  const result = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'projectnexus'
  `);

  for (const row of result.rows) {
    await pool.query(`ANALYZE projectnexus.${row.tablename}`);
  }

  }

/**
 * Run VACUUM ANALYZE on all tables to reclaim space and update statistics.
 * Should be run regularly (e.g., weekly).
 */
export async function vacuumAnalyze(): Promise<void> {
  const result = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'projectnexus'
  `);

  for (const row of result.rows) {
    try {
      await pool.query(`VACUUM ANALYZE projectnexus.${row.tablename}`);
    } catch (error) {
      console.error(`Failed to vacuum ${row.tablename}:`, error);
    }
  }

  }

/**
 * Get database connection pool statistics.
 */
export async function getPoolStats(): Promise<{
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}> {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE state = 'idle') AS idle_count,
      COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting_count
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);

  return result.rows[0];
}

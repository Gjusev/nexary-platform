/**
 * Change Detection Service
 * Detects and tracks changes in external documents
 *
 * Features:
 * - Checksum-based change detection
 * - Version comparison
 * - Timestamp-based filtering
 * - Change aggregation
 */

import { pool } from '../db';
import { generateChecksum } from '../crypto-utils';

export interface DocumentChange {
  externalDocumentId: string;
  dataSourceId: string;
  externalId: string;
  title: string;
  changeType: 'created' | 'updated' | 'deleted';
  previousChecksum?: string;
  newChecksum?: string;
  previousVersion?: string;
  newVersion?: string;
  previousUpdatedAt?: Date;
  newUpdatedAt?: Date;
  detectedAt: Date;
}

export interface ChangeDetectionOptions {
  since?: Date;
  dataSourceId?: string;
  sourceType?: string;
  includeDeleted?: boolean;
}

/**
 * Detect changes by comparing checksums
 */
export async function detectChangesByChecksum(
  dataSourceId: string,
  documents: Array<{ externalId: string; content: string; updatedAt: Date }>
): Promise<DocumentChange[]> {
  const changes: DocumentChange[] = [];

  for (const doc of documents) {
    const newChecksum = generateChecksum(doc.content);

    // Find existing document
    const result = await pool.query(`
      SELECT id, checksum, external_updated_at as "externalUpdatedAt", external_version as "externalVersion"
      FROM projectnexus.external_documents
      WHERE data_source_id = $1
        AND external_id = $2
        AND deleted_at IS NULL
    `, [dataSourceId, doc.externalId]);

    if (result.rows.length === 0) {
      // New document
      changes.push({
        externalDocumentId: '', // Will be set when created
        dataSourceId,
        externalId: doc.externalId,
        title: '', // Will be filled in
        changeType: 'created',
        newChecksum: newChecksum,
        newUpdatedAt: doc.updatedAt,
        detectedAt: new Date()
      });
    } else {
      const existing = result.rows[0];

      // Check for changes
      if (existing.checksum !== newChecksum) {
        changes.push({
          externalDocumentId: existing.id,
          dataSourceId,
          externalId: doc.externalId,
          title: '',
          changeType: 'updated',
          previousChecksum: existing.checksum,
          newChecksum,
          previousVersion: existing.externalVersion,
          previousUpdatedAt: existing.externalUpdatedAt,
          newUpdatedAt: doc.updatedAt,
          detectedAt: new Date()
        });
      }
    }
  }

  return changes;
}

/**
 * Detect deleted documents
 */
export async function detectDeletedDocuments(
  dataSourceId: string,
  currentExternalIds: string[]
): Promise<DocumentChange[]> {
  const changes: DocumentChange[] = [];

  // Find documents that exist in our database but not in current sync
  const result = await pool.query(`
    SELECT id, external_id, title
    FROM projectnexus.external_documents
    WHERE data_source_id = $1
      AND deleted_at IS NULL
  `, [dataSourceId]);

  const existingIds = new Set(result.rows.map(r => r.external_id));

  for (const row of result.rows) {
    if (!currentExternalIds.includes(row.external_id)) {
      changes.push({
        externalDocumentId: row.id,
        dataSourceId,
        externalId: row.external_id,
        title: row.title,
        changeType: 'deleted',
        detectedAt: new Date()
      });
    }
  }

  return changes;
}

/**
 * Get changes since a specific date
 */
export async function getChangesSince(
  options: ChangeDetectionOptions
): Promise<DocumentChange[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (options.dataSourceId) {
    conditions.push(`data_source_id = $${paramIndex++}`);
    values.push(options.dataSourceId);
  }

  if (options.since) {
    conditions.push(`last_updated_at >= $${paramIndex++}`);
    values.push(options.since);
  }

  if (!options.includeDeleted) {
    conditions.push(`deleted_at IS NULL`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      id as "externalDocumentId",
      data_source_id as "dataSourceId",
      external_id as "externalId",
      title,
      checksum as "newChecksum",
      external_updated_at as "newUpdatedAt",
      external_version as "newVersion",
      last_updated_at as "detectedAt"
    FROM projectnexus.external_documents
    ${whereClause}
    ORDER BY last_updated_at DESC
  `, values);

  // Map to DocumentChange format
  return result.rows.map(row => ({
    ...row,
    changeType: 'updated' as const
  }));
}

/**
 * Compare two versions and determine change type
 */
export function compareVersions(
  previousVersion: string | undefined,
  newVersion: string | undefined
): 'created' | 'updated' | 'unchanged' {
  if (!previousVersion) {
    return 'created';
  }

  if (!newVersion) {
    return 'updated';
  }

  // Simple string comparison
  if (previousVersion === newVersion) {
    return 'unchanged';
  }

  return 'updated';
}

/**
 * Calculate change statistics
 */
export async function getChangeStatistics(
  dataSourceId: string,
  since?: Date
): Promise<{
  created: number;
  updated: number;
  deleted: number;
  total: number;
}> {
  const conditions: string[] = ['data_source_id = $1'];
  const values: any[] = [dataSourceId];
  let paramIndex = 2;

  if (since) {
    conditions.push(`first_seen_at >= $${paramIndex++}`);
    values.push(since);
  }

  const whereClause = conditions.join(' AND ');

  const result = await pool.query(`
    SELECT
      COUNT(CASE WHEN first_seen_at >= $2 THEN 1 END) as created,
      COUNT(CASE WHEN first_seen_at < $2 AND last_updated_at >= $2 THEN 1 END) as updated,
      COUNT(CASE WHEN deleted_at >= $2 THEN 1 END) as deleted,
      COUNT(*) as total
    FROM projectnexus.external_documents
    WHERE ${whereClause}
  `, since ? [dataSourceId, since] : [dataSourceId]);

  return {
    created: parseInt(result.rows[0].created) || 0,
    updated: parseInt(result.rows[0].updated) || 0,
    deleted: parseInt(result.rows[0].deleted) || 0,
    total: parseInt(result.rows[0].total) || 0
  };
}

/**
 * Mark documents as deleted
 */
export async function markDocumentsAsDeleted(
  externalDocumentIds: string[]
): Promise<void> {
  if (externalDocumentIds.length === 0) {
    return;
  }

  await pool.query(`
    UPDATE projectnexus.external_documents
    SET deleted_at = NOW(),
        sync_status = 'deleted'
    WHERE id = ANY($1)
  `, [externalDocumentIds]);

  // Also mark associated master documents as deleted
  await pool.query(`
    UPDATE projectnexus.master_documents
    SET status = 'deleted'
    WHERE external_document_id = ANY($1)
  `, [externalDocumentIds]);
}

/**
 * Get documents that need resyncing
 */
export async function getDocumentsNeedingResync(
  dataSourceId?: string,
  limit = 100
): Promise<Array<{
  id: string;
  externalId: string;
  title: string;
  dataSourceId: string;
  lastUpdatedAt: Date;
}>> {
  const conditions: string[] = ['sync_status = $1'];
  const values: any[] = ['pending'];
  let paramIndex = 2;

  if (dataSourceId) {
    conditions.push(`data_source_id = $${paramIndex++}`);
    values.push(dataSourceId);
  }

  const whereClause = conditions.join(' AND ');

  const result = await pool.query(`
    SELECT
      id,
      external_id as "externalId",
      title,
      data_source_id as "dataSourceId",
      last_updated_at as "lastUpdatedAt"
    FROM projectnexus.external_documents
    WHERE ${whereClause}
    ORDER BY last_updated_at ASC
    LIMIT $${paramIndex++}
  `, [...values, limit]);

  return result.rows;
}

/**
 * Get change summary for UI display
 */
export async function getChangeSummary(
  dataSourceId: string,
  since?: Date
): Promise<{
  dataSourceId: string;
  dataSourceName: string;
  sourceType: string;
  changes: {
    created: number;
    updated: number;
    deleted: number;
  };
  lastSyncAt?: Date;
  nextSyncAt?: Date;
}> {
  const result = await pool.query(`
    SELECT
      ds.id as "dataSourceId",
      ds.name as "dataSourceName",
      ds.source_type as "sourceType",
      ds.last_sync_at as "lastSyncAt",
      ds.next_sync_at as "nextSyncAt"
    FROM projectnexus.data_sources ds
    WHERE ds.id = $1
  `, [dataSourceId]);

  if (result.rows.length === 0) {
    throw new Error(`Data source not found: ${dataSourceId}`);
  }

  const stats = await getChangeStatistics(dataSourceId, since);

  return {
    ...result.rows[0],
    changes: stats
  };
}

/**
 * Validate checksum consistency
 */
export async function validateChecksums(
  externalDocumentId: string
): Promise<{
  valid: boolean;
  storedChecksum: string;
  calculatedChecksum: string;
}> {
  const result = await pool.query(`
    SELECT content, checksum
    FROM projectnexus.external_documents
    WHERE id = $1
  `, [externalDocumentId]);

  if (result.rows.length === 0) {
    throw new Error(`External document not found: ${externalDocumentId}`);
  }

  const { content, checksum: storedChecksum } = result.rows[0];
  const calculatedChecksum = generateChecksum(content);

  return {
    valid: storedChecksum === calculatedChecksum,
    storedChecksum,
    calculatedChecksum
  };
}

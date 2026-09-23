/**
 * Sync Processor
 * Processes sync jobs and synchronizes documents from external sources
 *
 * Features:
 * - Full and incremental sync
 * - Change detection via checksums
 * - Document processing and RAG assignment
 * - Error handling and retry
 * - Progress tracking
 */

import { pool } from '../db';
import { ConnectorFactory, type ConnectorAuthConfig } from '../connectors/connector-factory';
import type { BaseConnector, ExternalDocument, SyncOptions } from '../connectors/base-connector';
import { decryptCredentials, generateChecksum } from '../crypto-utils';

export interface SyncJob {
  id: string;
  dataSourceId: string;
  jobType: 'full' | 'incremental' | 'webhook' | 'manual';
  triggerType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  documentsFetched: number;
  documentsCreated: number;
  documentsUpdated: number;
  documentsDeleted: number;
  documentsFailed: number;
  errorMessage?: string;
  errorCount: number;
  totalItems?: number;
  processedItems: number;
  progressPercentage?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  duration?: number;
}

export interface DataSource {
  id: string;
  teamSlug: string;
  name: string;
  sourceType: string;
  config: Record<string, unknown>;
  syncFrequency: string;
  syncEnabled: boolean;
  status: string;
  autoRagPackageIds: string[];
  lastSyncAt?: Date;
}

export interface ProcessResult {
  success: boolean;
  documentsCreated: number;
  documentsUpdated: number;
  documentsDeleted: number;
  documentsFailed: number;
  errors: Array<{ documentId: string; error: string }>;
  duration: number;
}

/**
 * Sync Processor class
 */
export class SyncProcessor {
  private processingJobs = new Set<string>();

  /**
   * Process a single sync job
   */
  async processJob(jobId: string): Promise<ProcessResult> {
    // Check if job is already being processed
    if (this.processingJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already being processed`);
    }

    this.processingJobs.add(jobId);
    const startTime = Date.now();

    try {
      // Load job
      const job = await this.loadJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Load data source
      const dataSource = await this.loadDataSource(job.dataSourceId);
      if (!dataSource) {
        throw new Error(`Data source not found: ${job.dataSourceId}`);
      }

      // Update job status to running
      await this.updateJobStatus(jobId, 'running', { startedAt: new Date() });

      // Create connector
      const connector = await this.createConnector(dataSource);
      if (!connector) {
        throw new Error(`Failed to create connector for type: ${dataSource.sourceType}`);
      }

      // Validate connection
      const healthCheck = await connector.validateConnection();
      if (!healthCheck.healthy) {
        throw new Error(`Connection validation failed: ${healthCheck.error}`);
      }

      // Determine sync options
      const syncOptions: SyncOptions = {
        fullSync: job.jobType === 'full',
        since: job.jobType === 'incremental' ? dataSource.lastSyncAt : undefined
      };

      // Fetch documents from external source
      const externalDocs = await connector.fetchDocuments(syncOptions);

      // Update job with total items
      await this.updateJobProgress(jobId, {
        totalItems: externalDocs.length,
        documentsFetched: externalDocs.length
      });

      // Process each document
      const result = await this.processDocuments(
        jobId,
        dataSource,
        externalDocs,
        connector
      );

      // Update job status to completed
      const duration = Date.now() - startTime;
      await this.updateJobStatus(jobId, 'completed', {
        completedAt: new Date(),
        documentsCreated: result.documentsCreated,
        documentsUpdated: result.documentsUpdated,
        documentsDeleted: result.documentsDeleted,
        documentsFailed: result.documentsFailed,
        duration
      });

      // Update data source last_sync_at
      await pool.query(
        'UPDATE projectnexus.data_sources SET last_sync_at = NOW() WHERE id = $1',
        [dataSource.id]
      );

      return {
        success: true,
        documentsCreated: result.documentsCreated,
        documentsUpdated: result.documentsUpdated,
        documentsDeleted: result.documentsDeleted,
        documentsFailed: result.documentsFailed,
        errors: result.errors,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.updateJobStatus(jobId, 'failed', {
        completedAt: new Date(),
        errorMessage,
        duration,
        errorCount: 1
      });

      throw error;
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  /**
   * Process all pending sync jobs
   */
  async processPendingJobs(maxJobs = 5): Promise<void> {
    const result = await pool.query(`
      SELECT id
      FROM projectnexus.sync_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
    `, [maxJobs]);

    for (const row of result.rows) {
      try {
        await this.processJob(row.id);
      } catch (error) {
        console.error(`[Sync Processor] Error processing job ${row.id}:`, error);
      }
    }
  }

  /**
   * Process documents from external source
   */
  private async processDocuments(
    jobId: string,
    dataSource: DataSource,
    externalDocs: ExternalDocument[],
    connector: BaseConnector
  ): Promise<{
    documentsCreated: number;
    documentsUpdated: number;
    documentsDeleted: number;
    documentsFailed: number;
    errors: Array<{ documentId: string; error: string }>;
  }> {
    let documentsCreated = 0;
    let documentsUpdated = 0;
    let documentsDeleted = 0;
    let documentsFailed = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    for (let i = 0; i < externalDocs.length; i++) {
      const doc = externalDocs[i];
      const processedItems = i + 1;
      const progressPercentage = Math.round((processedItems / externalDocs.length) * 100);

      try {
        // Check if document already exists
        const existingDoc = await this.findExternalDocument(
          dataSource.id,
          doc.externalId
        );

        // Generate checksum for change detection
        const checksum = generateChecksum(doc.content);

        if (existingDoc) {
          // Check if document has changed
          const hasChanged = await this.checkDocumentChanged(
            existingDoc.id,
            checksum,
            doc.updatedAt
          );

          if (hasChanged) {
            // Update existing document
            await this.updateExternalDocument(
              existingDoc.id,
              doc,
              checksum,
              'indexed'
            );
            documentsUpdated++;

            // Update master document if exists
            const masterDoc = await this.findMasterDocument(existingDoc.id);
            if (masterDoc) {
              await this.updateMasterDocument(masterDoc.id, doc);
              // Re-process RAG assignments
              await this.processRagAssignments(
                dataSource,
                masterDoc.id,
                doc
              );
            }
          }
        } else {
          // Create new external document
          const externalDocId = await this.createExternalDocument(
            dataSource.id,
            doc,
            checksum
          );
          documentsCreated++;

          // Create master document
          const masterDocId = await this.createMasterDocument(
            dataSource,
            externalDocId,
            doc
          );

          // Process RAG assignments
          await this.processRagAssignments(
            dataSource,
            masterDocId,
            doc
          );
        }

        // Update progress
        await this.updateJobProgress(jobId, {
          processedItems,
          progressPercentage
        });
      } catch (error) {
        documentsFailed++;
        errors.push({
          documentId: doc.externalId,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`[Sync Processor] Error processing document ${doc.externalId}:`, error);
      }
    }

    return {
      documentsCreated,
      documentsUpdated,
      documentsDeleted,
      documentsFailed,
      errors
    };
  }

  /**
   * Process RAG assignments for a document
   */
  private async processRagAssignments(
    dataSource: DataSource,
    masterDocId: string,
    externalDoc: ExternalDocument
  ): Promise<void> {
    if (dataSource.autoRagPackageIds.length === 0) {
      return;
    }

    for (const ragPackageId of dataSource.autoRagPackageIds) {
      try {
        // Check if already assigned
        const existingAssignment = await pool.query(`
          SELECT id
          FROM projectnexus.document_rag_assignments
          WHERE master_document_id = $1
            AND rag_package_id = $2
        `, [masterDocId, ragPackageId]);

        if (existingAssignment.rows.length === 0) {
          // Create assignment
          await pool.query(`
            INSERT INTO projectnexus.document_rag_assignments (
              master_document_id,
              rag_package_id,
              assigned_at,
              assigned_by
            ) VALUES ($1, $2, NOW(), 'system')
          `, [masterDocId, ragPackageId]);

          // Trigger RAG processing
          await this.triggerRagProcessing(masterDocId, ragPackageId, externalDoc);
        }
      } catch (error) {
        console.error(`[Sync Processor] Error assigning to RAG package ${ragPackageId}:`, error);
      }
    }
  }

  /**
   * Trigger RAG processing for a document
   */
  private async triggerRagProcessing(
    masterDocId: string,
    ragPackageId: string,
    externalDoc: ExternalDocument
  ): Promise<void> {
    // This would integrate with the existing RAG processing system
    // For now, just log that processing should happen
    // TODO: Integrate with lib/rag/document-processor.ts
    // Example:
    // await processRagAssignment(masterDocId, ragPackageId, externalDoc.content);
  }

  /**
   * Load sync job from database
   */
  private async loadJob(jobId: string): Promise<SyncJob | null> {
    const result = await pool.query(`
      SELECT
        id,
        data_source_id as "dataSourceId",
        job_type as "jobType",
        trigger_type as "triggerType",
        status,
        started_at as "startedAt",
        completed_at as "completedAt",
        documents_fetched as "documentsFetched",
        documents_created as "documentsCreated",
        documents_updated as "documentsUpdated",
        documents_deleted as "documentsDeleted",
        documents_failed as "documentsFailed",
        error_message as "errorMessage",
        error_count as "errorCount",
        total_items as "totalItems",
        processed_items as "processedItems",
        progress_percentage as "progressPercentage",
        metadata,
        created_at as "createdAt"
      FROM projectnexus.sync_jobs
      WHERE id = $1
    `, [jobId]);

    return result.rows[0] || null;
  }

  /**
   * Load data source from database
   */
  private async loadDataSource(dataSourceId: string): Promise<DataSource | null> {
    const result = await pool.query(`
      SELECT
        id,
        team_slug as "teamSlug",
        name,
        source_type as "sourceType",
        config,
        sync_frequency as "syncFrequency",
        sync_enabled as "syncEnabled",
        status,
        auto_rag_package_ids as "autoRagPackageIds",
        last_sync_at as "lastSyncAt"
      FROM projectnexus.data_sources
      WHERE id = $1
    `, [dataSourceId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Decrypt credentials
    let config = row.config as Record<string, unknown>;
    if (config.credentials && typeof config.credentials === 'string') {
      try {
        config.credentials = await decryptCredentials(config.credentials);
      } catch (error) {
        console.error('[Sync Processor] Error decrypting credentials:', error);
        return null;
      }
    }

    return {
      id: row.id,
      teamSlug: row.teamSlug,
      name: row.name,
      sourceType: row.sourceType,
      config,
      syncFrequency: row.syncFrequency,
      syncEnabled: row.syncEnabled,
      status: row.status,
      autoRagPackageIds: row.autoRagPackageIds || [],
      lastSyncAt: row.lastSyncAt
    };
  }

  /**
   * Create connector instance
   */
  private async createConnector(
    dataSource: DataSource
  ): Promise<BaseConnector | null> {
    try {
      const config: ConnectorAuthConfig = {
        type: dataSource.config.type as any,
        credentials: dataSource.config.credentials as Record<string, string>,
        baseUrl: dataSource.config.baseUrl as string | undefined,
        urls: dataSource.config.urls as string[] | undefined,
        maxDepth: dataSource.config.maxDepth as number | undefined,
        maxPages: dataSource.config.maxPages as number | undefined,
        allowedDomains: dataSource.config.allowedDomains as string[] | undefined,
        excludePatterns: dataSource.config.excludePatterns as string[] | undefined,
        includePatterns: dataSource.config.includePatterns as string[] | undefined,
        followLinks: dataSource.config.followLinks as boolean | undefined,
        respectRobotsTxt: dataSource.config.respectRobotsTxt as boolean | undefined,
        userAgent: dataSource.config.userAgent as string | undefined,
        timeout: dataSource.config.timeout as number | undefined
      };

      return ConnectorFactory.create(dataSource.sourceType, config, dataSource.id);
    } catch (error) {
      console.error('[Sync Processor] Error creating connector:', error);
      return null;
    }
  }

  /**
   * Find external document by data source and external ID
   */
  private async findExternalDocument(
    dataSourceId: string,
    externalId: string
  ): Promise<{ id: string; checksum: string; externalUpdatedAt: Date } | null> {
    const result = await pool.query(`
      SELECT id, checksum, external_updated_at as "externalUpdatedAt"
      FROM projectnexus.external_documents
      WHERE data_source_id = $1
        AND external_id = $2
        AND deleted_at IS NULL
    `, [dataSourceId, externalId]);

    return result.rows[0] || null;
  }

  /**
   * Check if document has changed
   */
  private async checkDocumentChanged(
    externalDocId: string,
    newChecksum: string,
    newUpdatedAt: Date
  ): Promise<boolean> {
    const result = await pool.query(`
      SELECT checksum, external_updated_at as "externalUpdatedAt"
      FROM projectnexus.external_documents
      WHERE id = $1
    `, [externalDocId]);

    if (result.rows.length === 0) {
      return true;
    }

    const current = result.rows[0];

    // Document has changed if checksum is different OR updated_at is newer
    return (
      current.checksum !== newChecksum ||
      newUpdatedAt > current.externalUpdatedAt
    );
  }

  /**
   * Create external document
   */
  private async createExternalDocument(
    dataSourceId: string,
    doc: ExternalDocument,
    checksum: string
  ): Promise<string> {
    const result = await pool.query(`
      INSERT INTO projectnexus.external_documents (
        data_source_id,
        external_id,
        external_url,
        title,
        content,
        content_type,
        author_name,
        author_email,
        external_updated_at,
        external_version,
        checksum,
        source_metadata,
        sync_status,
        indexed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'indexed', NOW())
      ON CONFLICT (data_source_id, external_id)
      DO UPDATE SET
        external_url = EXCLUDED.external_url,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        content_type = EXCLUDED.content_type,
        author_name = EXCLUDED.author_name,
        author_email = EXCLUDED.author_email,
        external_updated_at = EXCLUDED.external_updated_at,
        external_version = EXCLUDED.external_version,
        checksum = EXCLUDED.checksum,
        source_metadata = EXCLUDED.source_metadata,
        sync_status = EXCLUDED.sync_status,
        indexed_at = EXCLUDED.indexed_at,
        last_updated_at = NOW()
      RETURNING id
    `, [
      dataSourceId,
      doc.externalId,
      doc.externalUrl || null,
      doc.title,
      doc.content,
      doc.contentType || null,
      doc.author?.name || null,
      doc.author?.email || null,
      doc.updatedAt,
      (doc.metadata as any).version || null,
      checksum,
      JSON.stringify(doc.metadata)
    ]);

    return result.rows[0].id;
  }

  /**
   * Update external document
   */
  private async updateExternalDocument(
    externalDocId: string,
    doc: ExternalDocument,
    checksum: string,
    syncStatus: string
  ): Promise<void> {
    await pool.query(`
      UPDATE projectnexus.external_documents
      SET
        external_url = $1,
        title = $2,
        content = $3,
        content_type = $4,
        author_name = $5,
        author_email = $6,
        external_updated_at = $7,
        external_version = $8,
        checksum = $9,
        source_metadata = $10,
        sync_status = $11,
        last_updated_at = NOW()
      WHERE id = $12
    `, [
      doc.externalUrl || null,
      doc.title,
      doc.content,
      doc.contentType || null,
      doc.author?.name || null,
      doc.author?.email || null,
      doc.updatedAt,
      (doc.metadata as any).version || null,
      checksum,
      JSON.stringify(doc.metadata),
      syncStatus,
      externalDocId
    ]);
  }

  /**
   * Create master document
   */
  private async createMasterDocument(
    dataSource: DataSource,
    externalDocId: string,
    doc: ExternalDocument
  ): Promise<string> {
    const result = await pool.query(`
      INSERT INTO projectnexus.master_documents (
        team_slug,
        filename,
        content_type,
        status,
        external_document_id,
        source_type,
        external_url,
        external_metadata,
        external_synced_at
      ) VALUES ($1, $2, $3, 'ready', $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      dataSource.teamSlug,
      doc.title,
      doc.contentType || 'text/plain',
      externalDocId,
      dataSource.sourceType,
      doc.externalUrl || null,
      JSON.stringify({
        author: doc.author,
        updatedAt: doc.updatedAt,
        ...doc.metadata
      })
    ]);

    return result.rows[0].id;
  }

  /**
   * Find master document by external document ID
   */
  private async findMasterDocument(
    externalDocId: string
  ): Promise<{ id: string } | null> {
    const result = await pool.query(`
      SELECT id
      FROM projectnexus.master_documents
      WHERE external_document_id = $1
    `, [externalDocId]);

    return result.rows[0] || null;
  }

  /**
   * Update master document
   */
  private async updateMasterDocument(
    masterDocId: string,
    doc: ExternalDocument
  ): Promise<void> {
    await pool.query(`
      UPDATE projectnexus.master_documents
      SET
        filename = $1,
        external_url = $2,
        external_metadata = $3,
        external_synced_at = NOW()
      WHERE id = $4
    `, [
      doc.title,
      doc.externalUrl || null,
      JSON.stringify({
        author: doc.author,
        updatedAt: doc.updatedAt,
        ...doc.metadata
      }),
      masterDocId
    ]);
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: string,
    updates: Partial<SyncJob>
  ): Promise<void> {
    const fields: string[] = ['status = $2'];
    const values: any[] = [jobId, status];
    let paramIndex = 3;

    if (updates.startedAt) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updates.startedAt);
    }

    if (updates.completedAt) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }

    if (updates.documentsCreated !== undefined) {
      fields.push(`documents_created = $${paramIndex++}`);
      values.push(updates.documentsCreated);
    }

    if (updates.documentsUpdated !== undefined) {
      fields.push(`documents_updated = $${paramIndex++}`);
      values.push(updates.documentsUpdated);
    }

    if (updates.documentsDeleted !== undefined) {
      fields.push(`documents_deleted = $${paramIndex++}`);
      values.push(updates.documentsDeleted);
    }

    if (updates.documentsFailed !== undefined) {
      fields.push(`documents_failed = $${paramIndex++}`);
      values.push(updates.documentsFailed);
    }

    if (updates.errorMessage) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(updates.errorMessage);
    }

    if (updates.errorCount !== undefined) {
      fields.push(`error_count = $${paramIndex++}`);
      values.push(updates.errorCount);
    }

    if (updates.duration) {
      fields.push(`duration_ms = $${paramIndex++}`);
      values.push(updates.duration);
    }

    await pool.query(
      `UPDATE projectnexus.sync_jobs SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    jobId: string,
    updates: {
      totalItems?: number;
      processedItems?: number;
      progressPercentage?: number;
      documentsFetched?: number;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [jobId];
    let paramIndex = 2;

    if (updates.totalItems !== undefined) {
      fields.push(`total_items = $${paramIndex++}`);
      values.push(updates.totalItems);
    }

    if (updates.processedItems !== undefined) {
      fields.push(`processed_items = $${paramIndex++}`);
      values.push(updates.processedItems);
    }

    if (updates.progressPercentage !== undefined) {
      fields.push(`progress_percentage = $${paramIndex++}`);
      values.push(updates.progressPercentage);
    }

    if (updates.documentsFetched !== undefined) {
      fields.push(`documents_fetched = $${paramIndex++}`);
      values.push(updates.documentsFetched);
    }

    if (fields.length === 0) {
      return;
    }

    await pool.query(
      `UPDATE projectnexus.sync_jobs SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
  }

  /**
   * Get processing status
   */
  getProcessingStatus(): {
    processingJobs: number;
    jobIds: string[];
  } {
    return {
      processingJobs: this.processingJobs.size,
      jobIds: Array.from(this.processingJobs)
    };
  }
}

// Singleton instance
let processorInstance: SyncProcessor | null = null;

/**
 * Get the singleton processor instance
 */
export function getSyncProcessor(): SyncProcessor {
  if (!processorInstance) {
    processorInstance = new SyncProcessor();
  }
  return processorInstance;
}

/**
 * Process a single sync job
 */
export async function processSyncJob(jobId: string): Promise<ProcessResult> {
  const processor = getSyncProcessor();
  return processor.processJob(jobId);
}

/**
 * Process all pending sync jobs
 */
export async function processPendingSyncJobs(maxJobs = 5): Promise<void> {
  const processor = getSyncProcessor();
  await processor.processPendingJobs(maxJobs);
}

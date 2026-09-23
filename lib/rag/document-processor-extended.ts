/**
 * Extended Document Processor
 * Processes documents with multi-source metadata and ACL support
 *
 * Features:
 * - Integration with external document sync
 * - ACL extraction and mapping
 * - Enhanced Qdrant payload generation
 * - Permission-aware chunking and embedding
 */

import { pool } from '../db';
import { generateEmbedding } from './embeddings';
import { upsertPoints, deletePoints } from './qdrant';
import type {
  EnhancedQdrantPayload,
  SourceMetadata,
  AclInfo
} from './qdrant-payload-types';
import type { ExternalDocument } from '../connectors/base-connector';

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

/**
 * Process RAG assignment for external document
 */
export async function processExternalDocumentRag(
  masterDocumentId: string,
  ragPackageId: string,
  externalDoc: ExternalDocument,
  dataSourceType: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    skipEmbedding?: boolean;
  }
): Promise<void> {
  try {
    // Get master document
    const masterDocResult = await pool.query(
      'SELECT * FROM projectnexus.master_documents WHERE id = $1',
      [masterDocumentId]
    );

    if (masterDocResult.rows.length === 0) {
      throw new Error(`Master document not found: ${masterDocumentId}`);
    }

    const masterDoc = masterDocResult.rows[0];

    // Get RAG package
    const packageResult = await pool.query(
      'SELECT * FROM projectnexus.rag_packages WHERE id = $1',
      [ragPackageId]
    );

    if (packageResult.rows.length === 0) {
      throw new Error(`RAG package not found: ${ragPackageId}`);
    }

    const ragPackage = packageResult.rows[0];

    // Extract ACLs from external document
    const acl = extractAclFromExternalDocument(
      externalDoc.permissions,
      [] // Mapped ACLs would come from external_document_acls table
    );

    // Build source metadata
    const sourceMetadata = buildSourceMetadata(
      dataSourceType,
      externalDoc,
      masterDoc
    );

    // Process document with enhanced metadata
    await processDocumentWithAcls(
      masterDocumentId,
      ragPackageId,
      externalDoc.content,
      externalDoc.title,
      ragPackage.team_slug,
      sourceMetadata,
      acl,
      options
    );

    // Update document status
    await pool.query(
      'UPDATE projectnexus.document_rag_assignments SET status = $1, processed_at = NOW() WHERE master_document_id = $2 AND rag_package_id = $3',
      ['ready', masterDocumentId, ragPackageId]
    );
  } catch (error) {
    console.error('[Document Processor] Error processing external document:', error);

    // Mark as failed
    await pool.query(
      'UPDATE projectnexus.document_rag_assignments SET status = $1, error = $2 WHERE master_document_id = $3 AND rag_package_id = $4',
      ['error', error instanceof Error ? error.message : String(error), masterDocumentId, ragPackageId]
    );

    throw error;
  }
}

/**
 * Extract ACL from external document
 */
function extractAclFromExternalDocument(
  permissions?: Array<{
    principalId: string;
    permissionLevel: 'read' | 'write' | 'admin' | 'owner';
  }>,
  mappedAcls?: Array<{
    internal_user_id?: string;
    internal_team_slug?: string;
    permission_level: 'read' | 'write' | 'admin';
  }>
): AclInfo {
  const acl: AclInfo = {
    source_permissions: permissions?.map(p => ({
      principal_id: p.principalId,
      principal_type: 'user' as const,
      permission_level: p.permissionLevel
    })),
    mapped_acls: mappedAcls?.map(a => ({
      internal_user_id: a.internal_user_id,
      internal_team_slug: a.internal_team_slug,
      permission_level: a.permission_level
    }))
  };

  // Build read/write/admin arrays from mapped ACLs
  const readUsers: string[] = [];
  const readTeams: string[] = [];
  const writeUsers: string[] = [];
  const writeTeams: string[] = [];
  const adminUsers: string[] = [];
  const adminTeams: string[] = [];

  for (const mapped of mappedAcls || []) {
    if (mapped.internal_user_id) {
      if (mapped.permission_level === 'read') readUsers.push(mapped.internal_user_id);
      if (mapped.permission_level === 'write') writeUsers.push(mapped.internal_user_id);
      if (mapped.permission_level === 'admin') adminUsers.push(mapped.internal_user_id);
    }
    if (mapped.internal_team_slug) {
      if (mapped.permission_level === 'read') readTeams.push(mapped.internal_team_slug);
      if (mapped.permission_level === 'write') writeTeams.push(mapped.internal_team_slug);
      if (mapped.permission_level === 'admin') adminTeams.push(mapped.internal_team_slug);
    }
  }

  acl.read_users = readUsers;
  acl.read_teams = readTeams;
  acl.write_users = writeUsers;
  acl.write_teams = writeTeams;
  acl.admin_users = adminUsers;
  acl.admin_teams = adminTeams;

  // Check if document is public (no ACLs means public by default)
  acl.public = !permissions || permissions.length === 0;

  return acl;
}

/**
 * Build source metadata from external document
 */
function buildSourceMetadata(
  sourceType: string,
  externalDoc: ExternalDocument,
  masterDoc: any
): SourceMetadata {
  const base: SourceMetadata = {
    source_type: sourceType as any,
    external_document_id: masterDoc.external_document_id,
    external_url: externalDoc.externalUrl,
    external_updated_at: externalDoc.updatedAt.toISOString(),
    author_name: externalDoc.author?.name,
    author_email: externalDoc.author?.email,
    author_id: externalDoc.author?.id,
    content_type: externalDoc.contentType
  };

  // Add source-specific metadata from externalDoc.metadata
  const meta = externalDoc.metadata as Record<string, unknown>;

  switch (sourceType) {
    case 'confluence':
      return {
        ...base,
        confluence: {
          space_key: meta.spaceKey as string,
          space_name: meta.spaceName as string,
          page_id: meta.pageId as number,
          version: meta.version as number,
          ancestors: meta.ancestors as Array<{ title: string; id: string }>
        }
      };

    case 'notion':
      return {
        ...base,
        notion: {
          database_id: meta.databaseId as string,
          parent_id: meta.parentId as string,
          parent_type: meta.parentType as any,
          created_time: meta.createdAt as string,
          last_edited_time: externalDoc.updatedAt.toISOString()
        }
      };

    case 'sharepoint':
      return {
        ...base,
        sharepoint: {
          library_name: meta.libraryName as string,
          file_extension: meta.fileExtension as string,
          folder_path: meta.folderPath as string,
          site_name: meta.siteName as string
        }
      };

    case 'google_drive':
      return {
        ...base,
        google_drive: {
          folder_id: meta.folderId as string,
          folder_name: meta.folderName as string,
          mime_type: externalDoc.contentType,
          file_extension: meta.fileExtension as string
        }
      };

    case 'slack':
      return {
        ...base,
        slack: {
          channel_id: meta.channelId as string,
          channel_name: meta.channelName as string,
          thread_ts: meta.threadTs as string
        }
      };

    case 'web':
      return {
        ...base,
        web: {
          domain: meta.domain as string,
          depth: meta.depth as number,
          canonical_url: meta.canonicalUrl as string,
          og_image: meta.ogImage as string
        }
      };

    case 'database':
      return {
        ...base,
        database: {
          table_name: meta.tableName as string,
          primary_key: meta.primaryKey as string,
          query: meta.query as string
        }
      };

    default:
      return base;
  }
}

/**
 * Process document with ACLs
 */
async function processDocumentWithAcls(
  masterDocumentId: string,
  ragPackageId: string,
  content: string,
  title: string,
  teamSlug: string,
  sourceMetadata: SourceMetadata,
  acl: AclInfo,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    skipEmbedding?: boolean;
  }
): Promise<void> {
  const chunkSize = options?.chunkSize || 1000;
  const chunkOverlap = options?.chunkOverlap || 200;

  // Chunk the text
  const chunks = chunkText(content, chunkSize, chunkOverlap);

  if (chunks.length === 0) {
    throw new Error('No chunks generated from content');
  }

  // Generate embeddings for all chunks
  let embeddings: number[][] = [];
  if (!options?.skipEmbedding) {
    embeddings = await Promise.all(
      chunks.map(chunk => generateEmbedding(chunk))
    );
  }

  // Build Qdrant points
  const points = chunks.map((chunk, index) => {
    const payload: EnhancedQdrantPayload = {
      chunk_index: index,
      text: chunk,
      document_id: masterDocumentId,
      filename: title,
      created_at: new Date().toISOString(),
      tags: buildTags(sourceMetadata),
      team_slug: teamSlug,
      packageId: ragPackageId,
      source: sourceMetadata,
      acl,
      status: 'ready'
    };

    return {
      id: `${masterDocumentId}_chunk_${index}`,
      vector: embeddings[index] || [],
      payload: flattenEnhancedPayload(payload)
    };
  });

  // Upsert points to Qdrant
  const collectionName = `rag_${ragPackageId}`;
  await upsertPoints(collectionName, points);

  // Store chunk IDs in database
  const pointIds = points.map(p => p.id);
  await pool.query(
    `UPDATE projectnexus.document_rag_assignments
     SET point_ids = $1, chunk_count = $2
     WHERE master_document_id = $3 AND rag_package_id = $4`,
    [pointIds, chunks.length, masterDocumentId, ragPackageId]
  );
}

/**
 * Chunk text into overlapping segments
 */
function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];

  if (text.length <= chunkSize) {
    return [text];
  }

  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);

    // Try to find a good break point (newline, period, space)
    let breakPoint = end;
    if (end < text.length) {
      // Look for newline within last 100 chars
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start && lastNewline > end - 100) {
        breakPoint = lastNewline + 1;
      } else {
        // Look for period within last 100 chars
        const lastPeriod = text.lastIndexOf('. ', end);
        if (lastPeriod > start && lastPeriod > end - 100) {
          breakPoint = lastPeriod + 2;
        } else {
          // Look for space within last 50 chars
          const lastSpace = text.lastIndexOf(' ', end);
          if (lastSpace > start && lastSpace > end - 50) {
            breakPoint = lastSpace + 1;
          }
        }
      }
    }

    chunks.push(text.slice(start, breakPoint).trim());

    start = breakPoint - chunkOverlap;
    if (start < 0) start = 0;
  }

  return chunks;
}

/**
 * Build tags from source metadata
 */
function buildTags(sourceMetadata: SourceMetadata): string[] {
  const tags: string[] = [`source:${sourceMetadata.source_type}`];

  if (sourceMetadata.author_name) {
    tags.push(`author:${sourceMetadata.author_name}`);
  }

  if (sourceMetadata.confluence?.space_key) {
    tags.push(`space:${sourceMetadata.confluence.space_key}`);
  }

  if (sourceMetadata.notion?.database_id) {
    tags.push(`database:${sourceMetadata.notion.database_id}`);
  }

  if (sourceMetadata.sharepoint?.library_name) {
    tags.push(`library:${sourceMetadata.sharepoint.library_name}`);
  }

  if (sourceMetadata.google_drive?.folder_name) {
    tags.push(`folder:${sourceMetadata.google_drive.folder_name}`);
  }

  if (sourceMetadata.slack?.channel_name) {
    tags.push(`channel:${sourceMetadata.slack.channel_name}`);
  }

  if (sourceMetadata.web?.domain) {
    tags.push(`domain:${sourceMetadata.web.domain}`);
  }

  if (sourceMetadata.database?.table_name) {
    tags.push(`table:${sourceMetadata.database.table_name}`);
  }

  return tags;
}

/**
 * Flatten enhanced payload for Qdrant storage
 */
function flattenEnhancedPayload(
  enhanced: EnhancedQdrantPayload
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {
    ...enhanced
  };

  // Flatten source metadata
  if (enhanced.source) {
    flattened.source_type = enhanced.source.source_type;
    flattened.external_document_id = enhanced.source.external_document_id;
    flattened.external_url = enhanced.source.external_url;
    flattened.external_updated_at = enhanced.source.external_updated_at;
    flattened.author_name = enhanced.source.author_name;
    flattened.author_email = enhanced.source.author_email;
    flattened.author_id = enhanced.source.author_id;
    flattened.content_type = enhanced.source.content_type;
    flattened.language = enhanced.source.language;
    flattened.word_count = enhanced.source.word_count;
    flattened.char_count = enhanced.source.char_count;

    // Add source-specific fields with prefix
    if (enhanced.source.confluence) {
      Object.entries(enhanced.source.confluence).forEach(([key, value]) => {
        flattened[`confluence_${key}`] = value;
      });
    }
    if (enhanced.source.notion) {
      Object.entries(enhanced.source.notion).forEach(([key, value]) => {
        flattened[`notion_${key}`] = value;
      });
    }
    if (enhanced.source.sharepoint) {
      Object.entries(enhanced.source.sharepoint).forEach(([key, value]) => {
        flattened[`sharepoint_${key}`] = value;
      });
    }
    if (enhanced.source.google_drive) {
      Object.entries(enhanced.source.google_drive).forEach(([key, value]) => {
        flattened[`gdrive_${key}`] = value;
      });
    }
    if (enhanced.source.slack) {
      Object.entries(enhanced.source.slack).forEach(([key, value]) => {
        flattened[`slack_${key}`] = value;
      });
    }
    if (enhanced.source.web) {
      Object.entries(enhanced.source.web).forEach(([key, value]) => {
        flattened[`web_${key}`] = value;
      });
    }
    if (enhanced.source.database) {
      Object.entries(enhanced.source.database).forEach(([key, value]) => {
        flattened[`database_${key}`] = value;
      });
    }
  }

  // Flatten ACL
  if (enhanced.acl) {
    flattened.acl_public = enhanced.acl.public;
    flattened.acl_read_users = JSON.stringify(enhanced.acl.read_users || []);
    flattened.acl_read_teams = JSON.stringify(enhanced.acl.read_teams || []);
    flattened.acl_write_users = JSON.stringify(enhanced.acl.write_users || []);
    flattened.acl_write_teams = JSON.stringify(enhanced.acl.write_teams || []);
    flattened.acl_admin_users = JSON.stringify(enhanced.acl.admin_users || []);
    flattened.acl_admin_teams = JSON.stringify(enhanced.acl.admin_teams || []);
  }

  return flattened;
}

/**
 * Re-process document when ACLs change
 */
export async function reprocessDocumentAcls(
  masterDocumentId: string,
  ragPackageId: string,
  newAcl: AclInfo
): Promise<void> {
  // Get current points
  const result = await pool.query(
    `SELECT point_ids
     FROM projectnexus.document_rag_assignments
     WHERE master_document_id = $1 AND rag_package_id = $2`,
    [masterDocumentId, ragPackageId]
  );

  if (result.rows.length === 0) {
    throw new Error(`RAG assignment not found for master_doc=${masterDocumentId}, rag_package=${ragPackageId}`);
  }

  const pointIds = result.rows[0].point_ids as string[];
  const collectionName = `rag_${ragPackageId}`;

  // Update ACL in each payload
  for (const pointId of pointIds) {
    const aclPayload = {
      acl_public: newAcl.public,
      acl_read_users: JSON.stringify(newAcl.read_users || []),
      acl_read_teams: JSON.stringify(newAcl.read_teams || []),
      acl_write_users: JSON.stringify(newAcl.write_users || []),
      acl_write_teams: JSON.stringify(newAcl.write_teams || []),
      acl_admin_users: JSON.stringify(newAcl.admin_users || []),
      acl_admin_teams: JSON.stringify(newAcl.admin_teams || [])
    };

    const url = `${QDRANT_URL}/collections/${collectionName}/points/${pointId}/payload`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (QDRANT_API_KEY) {
      headers['api-key'] = QDRANT_API_KEY;
    }

    await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ payload: aclPayload })
    });
  }
}

/**
 * Delete document from RAG package
 */
export async function deleteDocumentFromRag(
  masterDocumentId: string,
  ragPackageId: string
): Promise<void> {
  const result = await pool.query(
    `SELECT point_ids
     FROM projectnexus.document_rag_assignments
     WHERE master_document_id = $1 AND rag_package_id = $2`,
    [masterDocumentId, ragPackageId]
  );

  if (result.rows.length === 0) {
    return; // Already deleted or never existed
  }

  const pointIds = result.rows[0].point_ids as string[];
  const collectionName = `rag_${ragPackageId}`;

  // Delete from Qdrant
  await deletePoints(collectionName, pointIds);

  // Delete assignment
  await pool.query(
    'DELETE FROM projectnexus.document_rag_assignments WHERE master_document_id = $1 AND rag_package_id = $2',
    [masterDocumentId, ragPackageId]
  );
}

/**
 * Bulk process multiple documents
 */
export async function bulkProcessDocuments(
  items: Array<{
    masterDocumentId: string;
    ragPackageId: string;
    externalDoc: ExternalDocument;
    dataSourceType: string;
  }>,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    skipEmbedding?: boolean;
    concurrency?: number;
  }
): Promise<{
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const concurrency = options?.concurrency || 3;
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    await Promise.allSettled(
      batch.map(async item => {
        try {
          await processExternalDocumentRag(
            item.masterDocumentId,
            item.ragPackageId,
            item.externalDoc,
            item.dataSourceType,
            options
          );
          succeeded.push(item.masterDocumentId);
        } catch (error) {
          failed.push({
            id: item.masterDocumentId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }

  return { succeeded, failed };
}

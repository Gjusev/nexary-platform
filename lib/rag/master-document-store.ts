/**
 * Master Document Store
 * Handles CRUD operations for the centralized document hub
 */

import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import type {
    MasterDocument,
    DocumentRagAssignment,
    RagDocumentStatus,
    DocumentFilters
} from '@/lib/rag/types';
import { deletePoints } from '@/lib/rag/qdrant';

// =====================================================
// Row Types
// =====================================================

type MasterDocumentRow = {
    id: string;
    team_slug: string;
    user_id: string;
    filename: string;
    original_filename: string;
    size: string | number;
    content_type: string;
    bucket: string | null;
    object_key: string | null;
    sha256: string | null;
    extracted_text: string | null;
    tags: string[] | null;
    status: string;
    error_message: string | null;
    created_at: Date | string;
    updated_at: Date | string;
    archived_at: Date | string | null;
    deleted_at: Date | string | null;
};

type AssignmentRow = {
    id: string;
    master_document_id: string;
    rag_package_id: string;
    rag_package_name?: string;
    rag_package_description?: string;
    status: string;
    chunk_count: number;
    point_ids: string[] | null;
    error_message: string | null;
    query_count: number;
    last_queried_at: Date | string | null;
    assigned_at: Date | string;
    processed_at: Date | string | null;
    assigned_by: string | null;
};

// =====================================================
// Helper Functions
// =====================================================

function coerceDate(value: Date | string): Date {
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date value: ${value}`);
    }
    return parsed;
}

function mapMasterDocument(row: MasterDocumentRow, assignments?: DocumentRagAssignment[]): MasterDocument {
    return {
        id: row.id,
        teamSlug: row.team_slug,
        userId: row.user_id,
        filename: row.filename,
        originalFilename: row.original_filename,
        size: typeof row.size === 'string' ? Number(row.size) : row.size,
        contentType: row.content_type,
        bucket: row.bucket ?? undefined,
        objectKey: row.object_key ?? undefined,
        sha256: row.sha256 ?? undefined,
        extractedText: row.extracted_text ?? undefined,
        tags: row.tags ?? [],
        status: row.status as RagDocumentStatus,
        errorMessage: row.error_message ?? undefined,
        createdAt: coerceDate(row.created_at).toISOString(),
        updatedAt: coerceDate(row.updated_at).toISOString(),
        archivedAt: row.archived_at ? coerceDate(row.archived_at).toISOString() : undefined,
        deletedAt: row.deleted_at ? coerceDate(row.deleted_at).toISOString() : undefined,
        ragAssignments: assignments,
    };
}

function mapAssignment(row: AssignmentRow): DocumentRagAssignment {
    return {
        id: row.id,
        masterDocumentId: row.master_document_id,
        ragPackageId: row.rag_package_id,
        ragPackageName: row.rag_package_name,
        ragPackageDescription: row.rag_package_description,
        status: row.status as DocumentRagAssignment['status'],
        chunkCount: row.chunk_count,
        pointIds: row.point_ids ?? [],
        errorMessage: row.error_message ?? undefined,
        queryCount: row.query_count,
        lastQueriedAt: row.last_queried_at ? coerceDate(row.last_queried_at).toISOString() : undefined,
        assignedAt: coerceDate(row.assigned_at).toISOString(),
        processedAt: row.processed_at ? coerceDate(row.processed_at).toISOString() : undefined,
        assignedBy: row.assigned_by ?? undefined,
    };
}

// =====================================================
// Master Document CRUD
// =====================================================

export async function listMasterDocuments(
    teamSlug: string,
    filters?: DocumentFilters
): Promise<{ documents: MasterDocument[]; total: number }> {
    const conditions: string[] = ['md.team_slug = $1', 'md.deleted_at IS NULL'];
    const params: unknown[] = [teamSlug];
    let paramIndex = 2;

    if (filters?.search) {
        conditions.push(`md.filename ILIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
    }

    if (filters?.status && filters.status !== 'all') {
        conditions.push(`md.status = $${paramIndex}`);
        params.push(filters.status);
        paramIndex++;
    }

    if (filters?.tags && filters.tags.length > 0) {
        conditions.push(`md.tags && $${paramIndex}::text[]`);
        params.push(filters.tags);
        paramIndex++;
    }

    if (!filters?.showArchived) {
        conditions.push('md.archived_at IS NULL');
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `
    SELECT COUNT(*) as total 
    FROM projectnexus.master_documents md 
    WHERE ${whereClause}
  `;
    const { rows: countRows } = await query<{ total: string }>(countQuery, params);
    const total = Number(countRows[0]?.total ?? 0);

    // Get documents
    const docsQuery = `
    SELECT 
      md.id, md.team_slug, md.user_id, md.filename, md.original_filename,
      md.size, md.content_type, md.bucket, md.object_key, md.sha256,
      md.tags, md.status, md.error_message, md.created_at, md.updated_at,
      md.archived_at, md.deleted_at
    FROM projectnexus.master_documents md
    WHERE ${whereClause}
    ORDER BY md.updated_at DESC
    LIMIT 100
  `;
    const { rows: docRows } = await query<MasterDocumentRow>(docsQuery, params);

    if (docRows.length === 0) {
        return { documents: [], total: 0 };
    }

    // Get assignments for all documents
    const docIds = docRows.map(r => r.id);
    const { rows: assignmentRows } = await query<AssignmentRow>(
        `SELECT 
      dra.id, dra.master_document_id, dra.rag_package_id, 
      rp.name as rag_package_name, rp.description as rag_package_description,
      dra.status, dra.chunk_count, dra.point_ids, dra.error_message,
      dra.query_count, dra.last_queried_at, dra.assigned_at, dra.processed_at, dra.assigned_by
    FROM projectnexus.document_rag_assignments dra
    JOIN projectnexus.rag_packages rp ON rp.id = dra.rag_package_id
    WHERE dra.master_document_id = ANY($1::uuid[])`,
        [docIds]
    );

    const assignmentsByDoc = new Map<string, DocumentRagAssignment[]>();
    for (const row of assignmentRows) {
        const list = assignmentsByDoc.get(row.master_document_id) ?? [];
        list.push(mapAssignment(row));
        assignmentsByDoc.set(row.master_document_id, list);
    }

    const documents = docRows.map(row =>
        mapMasterDocument(row, assignmentsByDoc.get(row.id) ?? [])
    );

    return { documents, total };
}

export async function getMasterDocumentById(id: string): Promise<MasterDocument | undefined> {
    const { rows } = await query<MasterDocumentRow>(
        `SELECT 
      id, team_slug, user_id, filename, original_filename,
      size, content_type, bucket, object_key, sha256,
      extracted_text, tags, status, error_message, created_at, updated_at,
      archived_at, deleted_at
      archived_at, deleted_at
    FROM projectnexus.master_documents
    WHERE id = $1 AND deleted_at IS NULL
    LIMIT 1`,
        [id]
    );

    if (rows.length === 0) return undefined;

    const { rows: assignmentRows } = await query<AssignmentRow>(
        `SELECT 
      dra.id, dra.master_document_id, dra.rag_package_id,
      rp.name as rag_package_name, rp.description as rag_package_description,
      dra.status, dra.chunk_count, dra.point_ids, dra.error_message,
      dra.query_count, dra.last_queried_at, dra.assigned_at, dra.processed_at, dra.assigned_by
    FROM projectnexus.document_rag_assignments dra
    JOIN projectnexus.rag_packages rp ON rp.id = dra.rag_package_id
    WHERE dra.master_document_id = $1`,
        [id]
    );

    return mapMasterDocument(rows[0], assignmentRows.map(mapAssignment));
}

export async function createMasterDocument(input: {
    teamSlug: string;
    userId: string;
    filename: string;
    originalFilename: string;
    size: number;
    contentType: string;
    bucket?: string;
    objectKey?: string;
    sha256?: string;
    extractedText?: string;
    tags?: string[];
    status?: RagDocumentStatus;
}): Promise<MasterDocument> {
    const id = randomUUID();

    const { rows } = await query<MasterDocumentRow>(
        `INSERT INTO projectnexus.master_documents 
      (id, team_slug, user_id, filename, original_filename, size, content_type, 
       bucket, object_key, sha256, extracted_text, tags, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
        [
            id,
            input.teamSlug,
            input.userId,
            input.filename,
            input.originalFilename,
            input.size,
            input.contentType,
            input.bucket ?? null,
            input.objectKey ?? null,
            input.sha256 ?? null,
            input.extractedText ?? null,
            input.tags ?? [],
            input.status ?? 'ready',
        ]
    );

    return mapMasterDocument(rows[0], []);
}

export async function updateMasterDocument(
    id: string,
    updates: {
        tags?: string[];
        status?: RagDocumentStatus;
        errorMessage?: string;
        archivedAt?: string | null;
        extractedText?: string;
    }
): Promise<MasterDocument | undefined> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.tags !== undefined) {
        setClauses.push(`tags = $${paramIndex}`);
        params.push(updates.tags);
        paramIndex++;
    }

    if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex}`);
        params.push(updates.status);
        paramIndex++;
    }

    if (updates.errorMessage !== undefined) {
        setClauses.push(`error_message = $${paramIndex}`);
        params.push(updates.errorMessage || null);
        paramIndex++;
    }

    if (updates.archivedAt !== undefined) {
        setClauses.push(`archived_at = $${paramIndex}`);
        params.push(updates.archivedAt ? new Date(updates.archivedAt) : null);
        paramIndex++;
    }

    if (updates.extractedText !== undefined) {
        setClauses.push(`extracted_text = $${paramIndex}`);
        params.push(updates.extractedText);
        paramIndex++;
    }

    params.push(id);

    await query(
        `UPDATE projectnexus.master_documents 
     SET ${setClauses.join(', ')} 
     WHERE id = $${paramIndex} AND deleted_at IS NULL`,
        params
    );

    return getMasterDocumentById(id);
}

export async function deleteMasterDocument(id: string, hard = false): Promise<boolean> {
    if (hard) {
        const { rowCount } = await query(
            'DELETE FROM projectnexus.master_documents WHERE id = $1',
            [id]
        );
        return (rowCount ?? 0) > 0;
    }

    const { rowCount } = await query(
        'UPDATE projectnexus.master_documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        [id]
    );
    return (rowCount ?? 0) > 0;
}

// =====================================================
// RAG Assignment Operations
// =====================================================

export async function getDocumentAssignments(documentId: string): Promise<DocumentRagAssignment[]> {
    const { rows } = await query<AssignmentRow>(
        `SELECT 
      dra.id, dra.master_document_id, dra.rag_package_id,
      rp.name as rag_package_name, rp.description as rag_package_description,
      dra.status, dra.chunk_count, dra.point_ids, dra.error_message,
      dra.query_count, dra.last_queried_at, dra.assigned_at, dra.processed_at, dra.assigned_by
    FROM projectnexus.document_rag_assignments dra
    JOIN projectnexus.rag_packages rp ON rp.id = dra.rag_package_id
    WHERE dra.master_document_id = $1`,
        [documentId]
    );

    return rows.map(mapAssignment);
}

export async function assignDocumentToRags(
    documentId: string,
    ragPackageIds: string[],
    assignedBy?: string
): Promise<DocumentRagAssignment[]> {
    if (ragPackageIds.length === 0) return [];

    // Insert assignments (ignore conflicts)
    for (const ragId of ragPackageIds) {
        await query(
            `INSERT INTO projectnexus.document_rag_assignments 
        (master_document_id, rag_package_id, status, assigned_by)
       VALUES ($1, $2, 'pending', $3)
       ON CONFLICT (master_document_id, rag_package_id) DO NOTHING`,
            [documentId, ragId, assignedBy ?? null]
        );
    }

    return getDocumentAssignments(documentId);
}

export async function removeDocumentFromRags(
    documentId: string,
    ragPackageIds: string[]
): Promise<{ deleted: number }> {
    if (ragPackageIds.length === 0) return { deleted: 0 };

    // Get point_ids and collection_name before deleting (for Qdrant cleanup)
    const { rows } = await query<{ point_ids: string[] | null; collection_name: string }>(
        `SELECT dra.point_ids, rp.collection_name
         FROM projectnexus.document_rag_assignments dra
         JOIN projectnexus.rag_packages rp ON rp.id = dra.rag_package_id
         WHERE dra.master_document_id = $1 AND dra.rag_package_id = ANY($2::uuid[])`,
        [documentId, ragPackageIds]
    );

    // Cleanup vectors from Qdrant
    const deletionPromises = rows.map(async (row) => {
        if (row.point_ids && row.point_ids.length > 0 && row.collection_name) {
            try {
                await deletePoints(row.collection_name, row.point_ids);
            } catch (error) {
                console.error(`Failed to delete points from collection ${row.collection_name}:`, error);
                // Continue with DB deletion even if Qdrant fails, to avoid inconsistency state
            }
        }
    });

    await Promise.all(deletionPromises);

    const { rowCount } = await query(
        `DELETE FROM projectnexus.document_rag_assignments 
     WHERE master_document_id = $1 AND rag_package_id = ANY($2::uuid[])`,
        [documentId, ragPackageIds]
    );

    return { deleted: rowCount ?? 0 };
}

export async function updateAssignmentStatus(
    documentId: string,
    ragPackageId: string,
    status: 'pending' | 'processing' | 'ready' | 'failed',
    updates?: {
        chunkCount?: number;
        pointIds?: string[];
        errorMessage?: string;
    }
): Promise<void> {
    const setClauses: string[] = ['status = $3'];
    const params: unknown[] = [documentId, ragPackageId, status];
    let paramIndex = 4;

    if (status === 'ready') {
        setClauses.push('processed_at = NOW()');
    }

    if (updates?.chunkCount !== undefined) {
        setClauses.push(`chunk_count = $${paramIndex}`);
        params.push(updates.chunkCount);
        paramIndex++;
    }

    if (updates?.pointIds !== undefined) {
        setClauses.push(`point_ids = $${paramIndex}`);
        params.push(updates.pointIds);
        paramIndex++;
    }

    if (updates?.errorMessage !== undefined) {
        setClauses.push(`error_message = $${paramIndex}`);
        params.push(updates.errorMessage || null);
        paramIndex++;
    }

    await query(
        `UPDATE projectnexus.document_rag_assignments 
     SET ${setClauses.join(', ')} 
     WHERE master_document_id = $1 AND rag_package_id = $2`,
        params
    );
}

export async function incrementAssignmentQueryCount(
    ragPackageId: string,
    documentIds: string[]
): Promise<void> {
    if (documentIds.length === 0) return;

    await query(
        `UPDATE projectnexus.document_rag_assignments 
     SET query_count = query_count + 1, last_queried_at = NOW()
     WHERE rag_package_id = $1 AND master_document_id = ANY($2::uuid[])`,
        [ragPackageId, documentIds]
    );
}

// =====================================================
// Analytics
// =====================================================

export async function getDocumentAnalytics(teamSlug: string): Promise<{
    totalDocuments: number;
    totalQueries: number;
    storageUsed: number;
    topDocuments: Array<{ id: string; filename: string; queryCount: number }>;
}> {
    const { rows: statsRows } = await query<{
        total_docs: string;
        total_queries: string;
        storage_used: string;
    }>(
        `SELECT 
      COUNT(*) as total_docs,
      COALESCE(SUM(dra.query_count), 0) as total_queries,
      COALESCE(SUM(md.size), 0) as storage_used
    FROM projectnexus.master_documents md
    LEFT JOIN projectnexus.document_rag_assignments dra ON dra.master_document_id = md.id
    WHERE md.team_slug = $1 AND md.deleted_at IS NULL`,
        [teamSlug]
    );

    const { rows: topRows } = await query<{
        id: string;
        filename: string;
        total_queries: string;
    }>(
        `SELECT 
      md.id, md.filename, COALESCE(SUM(dra.query_count), 0) as total_queries
    FROM projectnexus.master_documents md
    LEFT JOIN projectnexus.document_rag_assignments dra ON dra.master_document_id = md.id
    WHERE md.team_slug = $1 AND md.deleted_at IS NULL
    GROUP BY md.id, md.filename
    ORDER BY total_queries DESC
    LIMIT 10`,
        [teamSlug]
    );

    return {
        totalDocuments: Number(statsRows[0]?.total_docs ?? 0),
        totalQueries: Number(statsRows[0]?.total_queries ?? 0),
        storageUsed: Number(statsRows[0]?.storage_used ?? 0),
        topDocuments: topRows.map(r => ({
            id: r.id,
            filename: r.filename,
            queryCount: Number(r.total_queries),
        })),
    };
}

// =====================================================
// Tag Helpers
// =====================================================

export async function getAllTags(teamSlug: string): Promise<string[]> {
    const { rows } = await query<{ tag: string }>(
        `SELECT DISTINCT unnest(tags) as tag 
     FROM projectnexus.master_documents 
     WHERE team_slug = $1 AND deleted_at IS NULL
     ORDER BY tag`,
        [teamSlug]
    );

    return rows.map(r => r.tag);
}

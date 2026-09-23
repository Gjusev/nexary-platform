import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import { query } from '@/lib/db';
import type { CreatePackageInput, RagDocument, RagPackage } from '@/lib/rag/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const LEGACY_STORAGE_FILE = path.join(DATA_DIR, 'rag-packages.json');

let legacyMigrationPromise: Promise<void> | null = null;

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

type PackageRow = {
  id: string;
  team_slug: string;
  name: string;
  description: string | null;
  collection_name: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type DocumentRow = {
  id: string;
  package_id: string;
  filename: string;
  size: string | number;
  content_type: string;
  uploaded_at: Date | string;
  chunk_count: number;
  point_ids: string[] | null;
  deleted_at?: Date | null;
  // New fields from migration 009
  tags?: string[] | null;
  status?: string;
  version?: number;
  parent_document_id?: string | null;
  query_count?: number;
  last_queried_at?: Date | string | null;
  archived_at?: Date | string | null;
  error_message?: string | null;
};

function coerceDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value received from database: ${value}`);
  }

  return parsed;
}

function mapDocument(row: DocumentRow): RagDocument {
  return {
    id: row.id,
    filename: row.filename,
    size: typeof row.size === 'string' ? Number(row.size) : row.size,
    contentType: row.content_type,
    uploadedAt: coerceDate(row.uploaded_at).toISOString(),
    chunkCount: row.chunk_count,
    pointIds: row.point_ids ?? undefined,
    // New fields
    tags: row.tags ?? [],
    status: (row.status as RagDocument['status']) || 'ready',
    version: row.version ?? 1,
    parentDocumentId: row.parent_document_id ?? undefined,
    queryCount: row.query_count ?? 0,
    lastQueriedAt: row.last_queried_at ? coerceDate(row.last_queried_at).toISOString() : undefined,
    archivedAt: row.archived_at ? coerceDate(row.archived_at).toISOString() : undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

function mapPackage(row: PackageRow, documents: RagDocument[]): RagPackage {
  return {
    id: row.id,
    teamSlug: row.team_slug,
    name: row.name,
    description: row.description ?? undefined,
    collectionName: row.collection_name,
    createdAt: coerceDate(row.created_at).toISOString(),
    updatedAt: coerceDate(row.updated_at).toISOString(),
    documents,
  };
}

async function migrateLegacyData(): Promise<void> {
  const { rows: existing } = await query<{ count: string }>('SELECT COUNT(*) AS count FROM projectnexus.rag_packages');
  const hasPackages = Number(existing[0]?.count ?? '0') > 0;
  if (hasPackages) {
    return;
  }

  try {
    const raw = await fs.readFile(LEGACY_STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as RagPackage[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return;
    }

    for (const pkg of parsed) {
      await query(
        `INSERT INTO projectnexus.rag_packages (id, team_slug, name, description, collection_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          pkg.id,
          pkg.teamSlug,
          pkg.name,
          pkg.description ?? null,
          pkg.collectionName,
          new Date(pkg.createdAt),
          new Date(pkg.updatedAt),
        ]
      );

      for (const doc of pkg.documents ?? []) {
        await query(
          `INSERT INTO projectnexus.rag_documents (id, package_id, filename, size, content_type, uploaded_at, chunk_count, point_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            doc.id,
            pkg.id,
            doc.filename,
            doc.size,
            doc.contentType,
            new Date(doc.uploadedAt),
            doc.chunkCount,
            doc.pointIds ?? null,
          ]
        );
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code && code !== 'ENOENT') {
      console.warn('Failed to migrate legacy RAG data', error);
    }
  }
}

async function ensureMigration(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyData();
  }
  await legacyMigrationPromise;
}

export async function listPackages(teamSlug: string, deletedOnly = false): Promise<RagPackage[]> {
  await ensureMigration();
  const where = deletedOnly ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
  const { rows: packageRows } = await query<PackageRow>(
    `SELECT id, team_slug, name, description, collection_name, created_at, updated_at
     FROM projectnexus.rag_packages
     WHERE team_slug = $1 AND ${where}
     ORDER BY updated_at DESC`,
    [teamSlug]
  );

  if (packageRows.length === 0) {
    return [];
  }

  const packageIds = packageRows.map((row) => row.id);
  const { rows: documentRows } = await query<DocumentRow>(
    `SELECT id, package_id, filename, size, content_type, uploaded_at, chunk_count, point_ids, deleted_at
     FROM projectnexus.rag_documents
     WHERE package_id = ANY($1::uuid[]) AND deleted_at IS NULL
     ORDER BY uploaded_at DESC`,
    [packageIds]
  );

  const documentsByPackage = new Map<string, RagDocument[]>();
  for (const row of documentRows) {
    const list = documentsByPackage.get(row.package_id) ?? [];
    list.push(mapDocument(row));
    documentsByPackage.set(row.package_id, list);
  }

  return packageRows.map((row) => mapPackage(row, documentsByPackage.get(row.id) ?? []));
}

export async function getPackageById(id: string, includeDeleted = false): Promise<RagPackage | undefined> {
  await ensureMigration();
  const where = includeDeleted ? 'TRUE' : 'deleted_at IS NULL';
  const { rows } = await query<PackageRow>(
    `SELECT id, team_slug, name, description, collection_name, created_at, updated_at
     FROM projectnexus.rag_packages
     WHERE id = $1 AND ${where}
     LIMIT 1`,
    [id]
  );

  const [row] = rows;
  if (!row) {
    return undefined;
  }

  const { rows: documentRows } = await query<DocumentRow>(
    `SELECT id, package_id, filename, size, content_type, uploaded_at, chunk_count, point_ids, deleted_at
     FROM projectnexus.rag_documents
     WHERE package_id = $1 AND deleted_at IS NULL
     ORDER BY uploaded_at DESC`,
    [id]
  );

  return mapPackage(row, documentRows.map(mapDocument));
}

export async function createPackage(input: CreatePackageInput): Promise<RagPackage> {
  await ensureMigration();
  const id = randomUUID();
  const collectionBase = slugify(`${input.teamSlug}-${input.name}`) || randomUUID();
  const collectionName = `${collectionBase}-${id.slice(0, 8)}`;

  const { rows } = await query<PackageRow>(
    `INSERT INTO projectnexus.rag_packages (id, team_slug, name, description, collection_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, team_slug, name, description, collection_name, created_at, updated_at`,
    [id, input.teamSlug, input.name, input.description ?? null, collectionName]
  );

  return mapPackage(rows[0], []);
}

export async function upsertPackage(updated: RagPackage): Promise<void> {
  await ensureMigration();
  await query(
    `INSERT INTO projectnexus.rag_packages (id, team_slug, name, description, collection_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id)
     DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW()`,
    [
      updated.id,
      updated.teamSlug,
      updated.name,
      updated.description ?? null,
      updated.collectionName,
      new Date(updated.createdAt),
      new Date(updated.updatedAt),
    ]
  );
}

export async function appendDocument(packageId: string, document: RagDocument): Promise<RagPackage> {
  await ensureMigration();
  await query(
    `INSERT INTO projectnexus.rag_documents (id, package_id, filename, size, content_type, uploaded_at, chunk_count, point_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      document.id,
      packageId,
      document.filename,
      document.size,
      document.contentType,
      new Date(document.uploadedAt),
      document.chunkCount,
      document.pointIds ?? null,
    ]
  );

  await query('UPDATE projectnexus.rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);
  const pkg = await getPackageById(packageId);
  if (!pkg) {
    throw new Error('RAG package not found after document append');
  }
  return pkg;
}

export async function removeDocument(
  packageId: string,
  documentId: string,
  hard = false,
  userId?: string,
  deleteFromQdrant = false
): Promise<{
  updatedPackage: RagPackage;
  removedDocument: RagDocument;
}> {
  await ensureMigration();
  const { rows } = await query<DocumentRow>(
    `SELECT id, package_id, filename, size, content_type, uploaded_at, chunk_count, point_ids, deleted_at
     FROM projectnexus.rag_documents
     WHERE id = $1 AND package_id = $2
     LIMIT 1`,
    [documentId, packageId]
  );

  const [row] = rows;
  if (!row) {
    throw new Error('RAG document not found');
  }

  // Get the package to get collection name
  const pkg = await getPackageById(packageId, true);
  if (!pkg) {
    throw new Error('RAG package not found');
  }

  const document = mapDocument(row);

  // Si es hard delete o se solicita explícitamente, eliminar de Qdrant
  // Nota: deleteFromQdrant debe manejarse en el caller que tiene acceso a la función deletePoints

  if (hard) {
    // Hard delete: eliminar completamente de la BD
    await query('DELETE FROM projectnexus.rag_documents WHERE id = $1 AND package_id = $2', [documentId, packageId]);
  } else {
    // Soft delete: marcar como eliminado
    await query(
      'UPDATE projectnexus.rag_documents SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND package_id = $3',
      [userId || '', documentId, packageId]
    );
  }

  await query('UPDATE projectnexus.rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);

  const updatedPkg = await getPackageById(packageId);
  if (!updatedPkg) {
    throw new Error('RAG package not found after document removal');
  }

  return { updatedPackage: updatedPkg, removedDocument: document };
}

export async function restoreDocument(packageId: string, documentId: string): Promise<RagPackage> {
  await ensureMigration();
  await query(
    'UPDATE projectnexus.rag_documents SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND package_id = $2',
    [documentId, packageId]
  );
  await query('UPDATE projectnexus.rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);

  const updatedPkg = await getPackageById(packageId);
  if (!updatedPkg) {
    throw new Error('RAG package not found after document restore');
  }
  return updatedPkg;
}

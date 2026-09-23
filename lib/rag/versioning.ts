/**
 * Document Versioning System
 *
 * Tracks document versions, changes, and history with:
 * - Version numbering (semantic versioning)
 * - Change tracking (diff, additions, deletions)
 * - Rollback support
 * - Branch support for parallel editing
 */

import { randomUUID } from 'crypto';
import { query } from '@/lib/db';

export interface DocumentVersion {
  id: string;
  documentId: string;
  packageId: string;
  version: string; // Semantic version (1.0.0, 1.1.0, 2.0.0)
  major: number;
  minor: number;
  patch: number;
  contentHash: string;
  chunkCount: number;
  changes: VersionChange[];
  metadata: VersionMetadata;
  createdAt: Date;
  createdBy: string;
  isCurrent: boolean;
}

export interface VersionChange {
  type: 'addition' | 'deletion' | 'modification' | 'restructure';
  description: string;
  chunkIndices?: number[];
  linesAffected?: number;
}

export interface VersionMetadata {
  size: number;
  encoding?: string;
  mimeType?: string;
  filename?: string;
  tags?: string[];
  commitMessage?: string;
  parentVersionId?: string;
  branch?: string;
  rollbackFrom?: string;
  mergedFrom?: string;
}

export interface VersionDiff {
  versionA: string;
  versionB: string;
  additions: number;
  deletions: number;
  modifications: number;
  chunksAdded: string[];
  chunksDeleted: string[];
  chunksModified: Array<{ old: string; new: string }>;
}

// ============================================================================
// Version Management
// ============================================================================

/**
 * Create a new document version
 */
export async function createDocumentVersion(params: {
  documentId: string;
  packageId: string;
  content: string;
  changes: VersionChange[];
  metadata: Partial<VersionMetadata>;
  createdBy: string;
  increment?: 'major' | 'minor' | 'patch';
}): Promise<DocumentVersion> {
  // Get current version
  const currentVersion = await getCurrentVersion(params.documentId);
  let newVersion = '1.0.0';
  let major = 1;
  let minor = 0;
  let patch = 0;

  if (currentVersion) {
    const increment = params.increment || determineIncrementType(params.changes);
    major = currentVersion.major;
    minor = currentVersion.minor;
    patch = currentVersion.patch;

    switch (increment) {
      case 'major':
        major++;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor++;
        patch = 0;
        break;
      case 'patch':
        patch++;
        break;
    }

    newVersion = `${major}.${minor}.${patch}`;
  }

  // Generate content hash
  const contentHash = generateHash(params.content);

  // Count chunks (rough estimate)
  const chunkCount = Math.ceil(params.content.length / 1000);

  // Create new version
  const versionId = randomUUID();
  const metadata: VersionMetadata = {
    size: params.content.length,
    ...params.metadata,
    parentVersionId: currentVersion?.id,
  };

  await query(
    `
    INSERT INTO rag_document_versions (
      id, document_id, package_id, version, major, minor, patch,
      content_hash, chunk_count, changes, metadata, created_by, is_current
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
    `,
    [
      versionId,
      params.documentId,
      params.packageId,
      newVersion,
      major,
      minor,
      patch,
      contentHash,
      chunkCount,
      JSON.stringify(params.changes),
      JSON.stringify(metadata),
      params.createdBy,
    ]
  );

  // Mark previous versions as not current
  if (currentVersion) {
    await query(
      `UPDATE rag_document_versions SET is_current = false WHERE document_id = $1 AND id != $2`,
      [params.documentId, versionId]
    );
  }

  return {
    id: versionId,
    documentId: params.documentId,
    packageId: params.packageId,
    version: newVersion,
    major,
    minor,
    patch,
    contentHash,
    chunkCount,
    changes: params.changes,
    metadata,
    createdAt: new Date(),
    createdBy: params.createdBy,
    isCurrent: true,
  };
}

/**
 * Get current version of a document
 */
export async function getCurrentVersion(documentId: string): Promise<DocumentVersion | null> {
  const result = await query(
    `
    SELECT id, document_id, package_id, version, major, minor, patch,
           content_hash, chunk_count, changes, metadata, created_at, created_by, is_current
    FROM rag_document_versions
    WHERE document_id = $1 AND is_current = true
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [documentId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    documentId: row.document_id,
    packageId: row.package_id,
    version: row.version,
    major: row.major,
    minor: row.minor,
    patch: row.patch,
    contentHash: row.content_hash,
    chunkCount: row.chunk_count,
    changes: row.changes,
    metadata: row.metadata,
    createdAt: row.created_at,
    createdBy: row.created_by,
    isCurrent: row.is_current,
  };
}

/**
 * Get all versions of a document
 */
export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  const result = await query(
    `
    SELECT id, document_id, package_id, version, major, minor, patch,
           content_hash, chunk_count, changes, metadata, created_at, created_by, is_current
    FROM rag_document_versions
    WHERE document_id = $1
    ORDER BY major DESC, minor DESC, patch DESC
    `,
    [documentId]
  );

  return result.rows.map(row => ({
    id: row.id,
    documentId: row.document_id,
    packageId: row.package_id,
    version: row.version,
    major: row.major,
    minor: row.minor,
    patch: row.patch,
    contentHash: row.content_hash,
    chunkCount: row.chunk_count,
    changes: row.changes,
    metadata: row.metadata,
    createdAt: row.created_at,
    createdBy: row.created_by,
    isCurrent: row.is_current,
  }));
}

/**
 * Get specific version by version string
 */
export async function getVersion(documentId: string, version: string): Promise<DocumentVersion | null> {
  const result = await query(
    `
    SELECT id, document_id, package_id, version, major, minor, patch,
           content_hash, chunk_count, changes, metadata, created_at, created_by, is_current
    FROM rag_document_versions
    WHERE document_id = $1 AND version = $2
    `,
    [documentId, version]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    documentId: row.document_id,
    packageId: row.package_id,
    version: row.version,
    major: row.major,
    minor: row.minor,
    patch: row.patch,
    contentHash: row.content_hash,
    chunkCount: row.chunk_count,
    changes: row.changes,
    metadata: row.metadata,
    createdAt: row.created_at,
    createdBy: row.created_by,
    isCurrent: row.is_current,
  };
}

/**
 * Rollback document to specific version
 */
export async function rollbackToVersion(
  documentId: string,
  version: string,
  createdBy: string
): Promise<DocumentVersion | null> {
  const targetVersion = await getVersion(documentId, version);
  if (!targetVersion) {
    throw new Error(`Version ${version} not found`);
  }

  // Get current content (this would need to be stored separately)
  // For now, we'll create a new version referencing the old one
  const newVersion = await createDocumentVersion({
    documentId,
    packageId: targetVersion.packageId,
    content: '', // Would need to retrieve actual content
    changes: [
      {
        type: 'restructure',
        description: `Rollback to version ${version}`,
      },
    ],
    metadata: {
      parentVersionId: targetVersion.id,
      rollbackFrom: targetVersion.id,
    },
    createdBy,
    increment: 'minor',
  });

  return newVersion;
}

/**
 * Compare two versions
 */
export async function compareVersions(
  documentId: string,
  versionA: string,
  versionB: string
): Promise<VersionDiff> {
  const [verA, verB] = await Promise.all([
    getVersion(documentId, versionA),
    getVersion(documentId, versionB),
  ]);

  if (!verA || !verB) {
    throw new Error('One or both versions not found');
  }

  // Analyze changes
  const changesA = verA.changes || [];
  const changesB = verB.changes || [];

  const additions = changesB.filter(c => c.type === 'addition').length;
  const deletions = changesB.filter(c => c.type === 'deletion').length;
  const modifications = changesB.filter(c => c.type === 'modification').length;

  return {
    versionA,
    versionB,
    additions,
    deletions,
    modifications,
    chunksAdded: [],
    chunksDeleted: [],
    chunksModified: [],
  };
}

/**
 * Get version history timeline
 */
export async function getVersionHistory(documentId: string): Promise<
  Array<{
    version: string;
    date: Date;
    changes: VersionChange[];
    createdBy: string;
  }>
> {
  const versions = await getDocumentVersions(documentId);

  return versions.map(v => ({
    version: v.version,
    date: v.createdAt,
    changes: v.changes,
    createdBy: v.createdBy,
  }));
}

/**
 * Create version branch
 */
export async function createVersionBranch(
  documentId: string,
  baseVersion: string,
  branchName: string,
  createdBy: string
): Promise<DocumentVersion> {
  const baseVer = await getVersion(documentId, baseVersion);
  if (!baseVer) {
    throw new Error(`Base version ${baseVersion} not found`);
  }

  const versionId = randomUUID();
  const { major, minor, patch } = baseVer;
  const branchVersion = `${major}.${minor}.${patch + 1}-${branchName}`;

  await query(
    `
    INSERT INTO rag_document_versions (
      id, document_id, package_id, version, major, minor, patch,
      content_hash, chunk_count, changes, metadata, created_by, is_current
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
    `,
    [
      versionId,
      documentId,
      baseVer.packageId,
      branchVersion,
      major,
      minor,
      patch + 1,
      baseVer.contentHash,
      baseVer.chunkCount,
      JSON.stringify([]),
      JSON.stringify({ parentVersionId: baseVer.id, branch: branchName }),
      createdBy,
    ]
  );

  return {
    ...baseVer,
    id: versionId,
    version: branchVersion,
    patch: patch + 1,
    metadata: { ...baseVer.metadata, branch: branchName },
  };
}

/**
 * Merge version branch
 */
export async function mergeVersionBranch(
  documentId: string,
  branchVersion: string,
  createdBy: string
): Promise<DocumentVersion | null> {
  const branch = await getVersion(documentId, branchVersion);
  if (!branch) {
    throw new Error(`Branch version ${branchVersion} not found`);
  }

  const current = await getCurrentVersion(documentId);
  if (!current) {
    throw new Error('No current version found');
  }

  // Create new merge version
  return createDocumentVersion({
    documentId,
    packageId: current.packageId,
    content: '', // Would need actual content
    changes: [
      {
        type: 'modification',
        description: `Merged branch ${branchVersion}`,
      },
    ],
    metadata: {
      parentVersionId: current.id,
      mergedFrom: branch.id,
    },
    createdBy,
    increment: 'minor',
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determine version increment type from changes
 */
function determineIncrementType(changes: VersionChange[]): 'major' | 'minor' | 'patch' {
  const hasRestructure = changes.some(c => c.type === 'restructure');
  const hasDeletion = changes.some(c => c.type === 'deletion');
  const hasModification = changes.some(c => c.type === 'modification');

  if (hasRestructure || hasDeletion) {
    return 'major';
  }

  if (hasModification) {
    return 'minor';
  }

  return 'patch';
}

/**
 * Generate hash for content
 */
function generateHash(content: string): string {
  // Simple hash for demonstration
  // In production, use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Compute diff between two text contents
 */
export function computeDiff(oldContent: string, newContent: string): {
  additions: number;
  deletions: number;
  modifications: number;
} {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple line-by-line diff
  const additions = newLines.filter(line => !oldLines.includes(line)).length;
  const deletions = oldLines.filter(line => !newLines.includes(line)).length;
  const modifications = Math.min(additions, deletions);

  return { additions, deletions, modifications };
}

/**
 * Calculate version distance
 */
export function versionDistance(versionA: string, versionB: string): number {
  const [majorA, minorA, patchA] = versionA.split('.').map(Number);
  const [majorB, minorB, patchB] = versionB.split('.').map(Number);

  const majorDiff = Math.abs(majorA - majorB) * 100;
  const minorDiff = Math.abs(minorA - minorB) * 10;
  const patchDiff = Math.abs(patchA - patchB);

  return majorDiff + minorDiff + patchDiff;
}

/**
 * Find common ancestor version
 */
export async function findCommonAncestor(
  documentId: string,
  versionA: string,
  versionB: string
): Promise<DocumentVersion | null> {
  const [verA, verB] = await Promise.all([
    getVersion(documentId, versionA),
    getVersion(documentId, versionB),
  ]);

  if (!verA || !verB) return null;

  // Traverse back from both versions to find common ancestor
  let currentA = verA;
  let currentB = verB;
  const visitedA = new Set<string>([currentA.id]);
  const visitedB = new Set<string>([currentB.id]);

  while (currentA.metadata?.parentVersionId || currentB.metadata?.parentVersionId) {
    if (currentA.metadata?.parentVersionId) {
      const parent = await getVersionById(currentA.metadata.parentVersionId);
      if (parent && visitedB.has(parent.id)) {
        return parent;
      }
      visitedA.add(parent?.id || '');
      currentA = parent || currentA;
    }

    if (currentB.metadata?.parentVersionId) {
      const parent = await getVersionById(currentB.metadata.parentVersionId);
      if (parent && visitedA.has(parent.id)) {
        return parent;
      }
      visitedB.add(parent?.id || '');
      currentB = parent || currentB;
    }
  }

  return null;
}

async function getVersionById(versionId: string): Promise<DocumentVersion | null> {
  const result = await query(
    `
    SELECT id, document_id, package_id, version, major, minor, patch,
           content_hash, chunk_count, changes, metadata, created_at, created_by, is_current
    FROM rag_document_versions
    WHERE id = $1
    `,
    [versionId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    documentId: row.document_id,
    packageId: row.package_id,
    version: row.version,
    major: row.major,
    minor: row.minor,
    patch: row.patch,
    contentHash: row.content_hash,
    chunkCount: row.chunk_count,
    changes: row.changes,
    metadata: row.metadata,
    createdAt: row.created_at,
    createdBy: row.created_by,
    isCurrent: row.is_current,
  };
}

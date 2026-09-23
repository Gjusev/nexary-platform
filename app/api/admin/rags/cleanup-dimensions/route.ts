import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { deleteCollection, EMBEDDING_VECTOR_SIZE } from '@/lib/rag/qdrant';
import { removePrefix } from '@/lib/storage/minio';

const stackServerApp = new StackServerApp({
    tokenStore: 'nextjs-cookie',
});

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

interface CollectionInfo {
    collectionName: string;
    packageId: string;
    packageName: string;
    teamSlug: string;
    vectorSize: number | null;
    status: 'compatible' | 'incompatible' | 'not_found' | 'error';
    error?: string;
}

async function getCollectionVectorSize(collectionName: string): Promise<{ size: number | null; error?: string }> {
    if (!QDRANT_URL) {
        return { size: null, error: 'QDRANT_URL not configured' };
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (QDRANT_API_KEY) {
            headers['api-key'] = QDRANT_API_KEY;
        }

        const response = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
            method: 'GET',
            headers,
        });

        if (response.status === 404) {
            return { size: null, error: 'not_found' };
        }

        if (!response.ok) {
            return { size: null, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        // Qdrant returns vector config in result.config.params.vectors.size (or result.config.params.vectors.default.size)
        const vectorsConfig = data?.result?.config?.params?.vectors;

        let size: number | null = null;
        if (typeof vectorsConfig === 'object' && vectorsConfig !== null) {
            // Could be { size: number } or { default: { size: number } } or named vectors
            if ('size' in vectorsConfig) {
                size = vectorsConfig.size;
            } else if ('default' in vectorsConfig && typeof vectorsConfig.default === 'object') {
                size = vectorsConfig.default.size;
            }
        }

        return { size };
    } catch (e) {
        return { size: null, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

/**
 * GET: List all RAG packages and check their collection dimensions
 */
export async function GET(request: NextRequest) {
    const user = await stackServerApp.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins (check for admin permission)
    const teams = await user.listTeams();
    const isAdmin = teams.some(t => t.displayName?.toLowerCase().includes('admin'));

    // Also check server metadata for admin flag
    const serverMetadata = user.serverMetadata as Record<string, unknown> | null;
    const hasAdminRole = serverMetadata?.role === 'admin' || serverMetadata?.isAdmin === true;

    if (!isAdmin && !hasAdminRole) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        // Get all RAG packages
        const { rows: packages } = await query<{
            id: string;
            name: string;
            team_slug: string;
            collection_name: string;
        }>(`
      SELECT id, name, team_slug, collection_name 
      FROM projectnexus.rag_packages 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

        const results: CollectionInfo[] = [];
        const currentDimension = EMBEDDING_VECTOR_SIZE;

        for (const pkg of packages) {
            const { size, error } = await getCollectionVectorSize(pkg.collection_name);

            let status: CollectionInfo['status'] = 'compatible';
            if (error === 'not_found') {
                status = 'not_found';
            } else if (error) {
                status = 'error';
            } else if (size !== null && size !== currentDimension) {
                status = 'incompatible';
            }

            results.push({
                collectionName: pkg.collection_name,
                packageId: pkg.id,
                packageName: pkg.name,
                teamSlug: pkg.team_slug,
                vectorSize: size,
                status,
                error: error !== 'not_found' ? error : undefined,
            });
        }

        const incompatible = results.filter(r => r.status === 'incompatible');
        const notFound = results.filter(r => r.status === 'not_found');
        const errors = results.filter(r => r.status === 'error');

        return NextResponse.json({
            success: true,
            currentDimension,
            summary: {
                total: results.length,
                compatible: results.filter(r => r.status === 'compatible').length,
                incompatible: incompatible.length,
                notFound: notFound.length,
                errors: errors.length,
            },
            incompatiblePackages: incompatible,
            notFoundPackages: notFound,
            errorPackages: errors,
        });
    } catch (e) {
        console.error('Failed to check RAG dimensions:', e);
        return NextResponse.json({ error: 'Failed to check dimensions' }, { status: 500 });
    }
}

/**
 * DELETE: Clean up packages with incompatible dimensions
 * Pass ?dryRun=true to just list what would be deleted
 */
export async function DELETE(request: NextRequest) {
    const user = await stackServerApp.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins
    const teams = await user.listTeams();
    const isAdmin = teams.some(t => t.displayName?.toLowerCase().includes('admin'));
    const serverMetadata = user.serverMetadata as Record<string, unknown> | null;
    const hasAdminRole = serverMetadata?.role === 'admin' || serverMetadata?.isAdmin === true;

    if (!isAdmin && !hasAdminRole) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const targetPackageId = url.searchParams.get('packageId'); // Optional: delete specific package

    try {
        // Get packages to check
        let packagesQuery = `
      SELECT id, name, team_slug, collection_name 
      FROM projectnexus.rag_packages 
      WHERE deleted_at IS NULL
    `;
        const params: string[] = [];

        if (targetPackageId) {
            packagesQuery += ' AND id = $1';
            params.push(targetPackageId);
        }

        const { rows: packages } = await query<{
            id: string;
            name: string;
            team_slug: string;
            collection_name: string;
        }>(packagesQuery, params);

        const currentDimension = EMBEDDING_VECTOR_SIZE;
        const toDelete: Array<{ id: string; name: string; teamSlug: string; collectionName: string; vectorSize: number }> = [];

        for (const pkg of packages) {
            const { size } = await getCollectionVectorSize(pkg.collection_name);

            if (size !== null && size !== currentDimension) {
                toDelete.push({
                    id: pkg.id,
                    name: pkg.name,
                    teamSlug: pkg.team_slug,
                    collectionName: pkg.collection_name,
                    vectorSize: size,
                });
            }
        }

        if (dryRun) {
            return NextResponse.json({
                success: true,
                dryRun: true,
                currentDimension,
                wouldDelete: toDelete.length,
                packages: toDelete,
                message: `Would delete ${toDelete.length} packages with incompatible dimensions. Use ?dryRun=false to proceed.`,
            });
        }

        // Actually delete
        const deleted: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        for (const pkg of toDelete) {
            try {
                // 1. Delete Qdrant collection
                try {
                    await deleteCollection(pkg.collectionName);
                } catch (e) {
                    console.warn(`Failed to delete Qdrant collection ${pkg.collectionName}:`, e);
                }

                // 2. Delete MinIO files
                try {
                    const bucket = process.env.MINIO_BUCKET || 'projectnexus';
                    const prefix = `team/${pkg.teamSlug}/packages/${pkg.id}/`;
                    await removePrefix(bucket, prefix);
                } catch (e) {
                    console.warn(`Failed to delete MinIO files for ${pkg.id}:`, e);
                }

                // 3. Hard delete from DB
                await query('DELETE FROM projectnexus.rag_packages WHERE id = $1', [pkg.id]);

                deleted.push(pkg.id);
            } catch (e) {
                failed.push({
                    id: pkg.id,
                    error: e instanceof Error ? e.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            success: true,
            currentDimension,
            deletedCount: deleted.length,
            failedCount: failed.length,
            deleted,
            failed,
        });
    } catch (e) {
        console.error('Failed to cleanup RAG dimensions:', e);
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }
}

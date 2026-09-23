/**
 * Script to clean up RAG packages with incompatible embedding dimensions
 * Run with: npx tsx scripts/cleanup-rag-dimensions.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });


const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DIMENSION = 3072; // text-embedding-3-large

interface Package {
    id: string;
    name: string;
    team_slug: string;
    collection_name: string;
}

async function getCollectionInfo(collectionName: string): Promise<{ size: number | null; exists: boolean }> {
    if (!QDRANT_URL) {
        console.error('QDRANT_URL not set');
        return { size: null, exists: false };
    }

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;

        const response = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
            method: 'GET',
            headers,
        });

        if (response.status === 404) {
            return { size: null, exists: false };
        }

        if (!response.ok) {
            console.warn(`Failed to get collection ${collectionName}: HTTP ${response.status}`);
            return { size: null, exists: true };
        }

        const data = await response.json();
        const vectorsConfig = data?.result?.config?.params?.vectors;

        let size: number | null = null;
        if (typeof vectorsConfig === 'object' && vectorsConfig !== null) {
            if ('size' in vectorsConfig) {
                size = vectorsConfig.size;
            }
        }

        return { size, exists: true };
    } catch (e) {
        console.error(`Error checking collection ${collectionName}:`, e);
        return { size: null, exists: false };
    }
}

async function deleteQdrantCollection(collectionName: string): Promise<boolean> {
    if (!QDRANT_URL) return false;

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;

        const response = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
            method: 'DELETE',
            headers,
        });

        return response.ok || response.status === 404;
    } catch (e) {
        console.error(`Failed to delete collection ${collectionName}:`, e);
        return false;
    }
}

async function main() {
    console.log('🔍 RAG Dimension Cleanup Script');
    console.log('================================');
    console.log(`Expected dimension: ${EXPECTED_DIMENSION}`);
    console.log(`Qdrant URL: ${QDRANT_URL ? '✓ configured' : '✗ NOT SET'}`);
    console.log(`Database URL: ${DATABASE_URL ? '✓ configured' : '✗ NOT SET'}`);
    console.log('');

    if (!QDRANT_URL || !DATABASE_URL) {
        console.error('❌ Missing required environment variables');
        process.exit(1);
    }

    // Use pg directly
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Get all RAG packages
        const result = await pool.query<Package>(`
      SELECT id, name, team_slug, collection_name 
      FROM projectnexus.rag_packages 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

        const packages = result.rows;
        console.log(`📦 Found ${packages.length} RAG packages\n`);

        const incompatible: Array<Package & { vectorSize: number }> = [];
        const notFound: Package[] = [];
        const compatible: Package[] = [];

        for (const pkg of packages) {
            const { size, exists } = await getCollectionInfo(pkg.collection_name);

            if (!exists) {
                notFound.push(pkg);
                console.log(`  ⚪ ${pkg.name} (${pkg.id}) - Collection not found in Qdrant`);
            } else if (size !== null && size !== EXPECTED_DIMENSION) {
                incompatible.push({ ...pkg, vectorSize: size });
                console.log(`  🔴 ${pkg.name} (${pkg.id}) - Dimension: ${size} (incompatible)`);
            } else {
                compatible.push(pkg);
                console.log(`  🟢 ${pkg.name} (${pkg.id}) - Dimension: ${size || 'unknown'} (OK)`);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   Compatible: ${compatible.length}`);
        console.log(`   Incompatible: ${incompatible.length}`);
        console.log(`   Not found in Qdrant: ${notFound.length}`);

        if (incompatible.length === 0) {
            console.log('\n✅ No incompatible packages found. Nothing to clean up.');
            await pool.end();
            return;
        }

        console.log('\n🗑️  Cleaning up incompatible packages...\n');

        for (const pkg of incompatible) {
            console.log(`   Deleting: ${pkg.name} (${pkg.id})`);

            // 1. Delete Qdrant collection
            const qdrantDeleted = await deleteQdrantCollection(pkg.collection_name);
            console.log(`      Qdrant collection: ${qdrantDeleted ? '✓ deleted' : '⚠ failed'}`);

            // 2. Hard delete from database (cascade will handle documents)
            try {
                await pool.query('DELETE FROM projectnexus.rag_packages WHERE id = $1', [pkg.id]);
                console.log(`      Database record: ✓ deleted`);
            } catch (e) {
                console.error(`      Database record: ✗ failed`, e);
            }
        }

        console.log('\n✅ Cleanup complete!');
        console.log(`   Deleted ${incompatible.length} incompatible RAG packages.`);
        console.log('\n💡 Users will need to re-upload their documents to create new RAGs with 3072 dimensions.');

        await pool.end();
    } catch (e) {
        console.error('❌ Script failed:', e);
        await pool.end();
        process.exit(1);
    }
}

main();

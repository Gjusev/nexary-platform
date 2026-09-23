/**
 * Script to check and clean chat documents with incompatible embedding dimensions
 * Run with: npx tsx scripts/cleanup-chat-embeddings.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DIMENSION = 3072;

async function main() {
    console.log('🔍 Chat Embeddings Dimension Check');
    console.log('===================================');
    console.log(`Expected dimension: ${EXPECTED_DIMENSION}`);
    console.log(`Database URL: ${DATABASE_URL ? '✓ configured' : '✗ NOT SET'}`);
    console.log('');

    if (!DATABASE_URL) {
        console.error('❌ Missing DATABASE_URL');
        process.exit(1);
    }

    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Check if chat_embeddings table exists
        const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'projectnexus' 
        AND table_name = 'chat_embeddings'
      )
    `);

        if (!tableCheck.rows[0].exists) {
            console.log('⚪ Table chat_embeddings does not exist yet.');
            await pool.end();
            return;
        }

        // Check embedding dimensions
        const dimCheck = await pool.query(`
      SELECT 
        CASE 
          WHEN vector_dims(embedding) = ${EXPECTED_DIMENSION} THEN 'compatible'
          ELSE 'incompatible'
        END as status,
        vector_dims(embedding) as dimension,
        COUNT(*) as count
      FROM projectnexus.chat_embeddings
      GROUP BY vector_dims(embedding)
      ORDER BY count DESC
    `);

        console.log('📊 Embedding dimensions in chat_embeddings:');
        let hasIncompatible = false;
        let incompatibleCount = 0;

        for (const row of dimCheck.rows) {
            const icon = row.status === 'compatible' ? '🟢' : '🔴';
            console.log(`   ${icon} ${row.dimension} dimensions: ${row.count} embeddings (${row.status})`);
            if (row.status === 'incompatible') {
                hasIncompatible = true;
                incompatibleCount += parseInt(row.count);
            }
        }

        if (!hasIncompatible) {
            console.log('\n✅ All embeddings have correct dimensions (3072). No cleanup needed.');
            await pool.end();
            return;
        }

        console.log(`\n⚠️  Found ${incompatibleCount} embeddings with incompatible dimensions.`);
        console.log('🗑️  Cleaning up...\n');

        // Find documents with incompatible embeddings
        const docsToDelete = await pool.query(`
      SELECT DISTINCT d.id, d.filename, d.conversation_id
      FROM projectnexus.chat_documents d
      JOIN projectnexus.chat_embeddings e ON e.document_id = d.id
      WHERE vector_dims(e.embedding) != ${EXPECTED_DIMENSION}
    `);

        console.log(`   Found ${docsToDelete.rows.length} documents with incompatible embeddings:\n`);

        for (const doc of docsToDelete.rows) {
            console.log(`   📄 ${doc.filename} (${doc.id})`);
        }

        // Delete incompatible embeddings
        const deleteResult = await pool.query(`
      DELETE FROM projectnexus.chat_embeddings
      WHERE vector_dims(embedding) != ${EXPECTED_DIMENSION}
    `);
        console.log(`\n   ✓ Deleted ${deleteResult.rowCount} incompatible embeddings`);

        // Also delete the parent documents since their embeddings are now gone
        for (const doc of docsToDelete.rows) {
            await pool.query(`DELETE FROM projectnexus.chat_documents WHERE id = $1`, [doc.id]);
        }
        console.log(`   ✓ Deleted ${docsToDelete.rows.length} affected documents`);

        console.log('\n✅ Cleanup complete!');
        console.log('💡 Users will need to re-upload their documents to the chat.');

        await pool.end();
    } catch (e) {
        console.error('❌ Script failed:', e);
        await pool.end();
        process.exit(1);
    }
}

main();

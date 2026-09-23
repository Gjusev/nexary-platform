import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const client = await pool.connect();

        console.log('✓ Connected to database');

        // Read migration file
        const migrationPath = path.join(process.cwd(), 'migrations', '006_templates_visibility.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('✓ Read migration file: 006_templates_visibility.sql');

        // Execute migration
        await client.query(sql);

        console.log('✓ Migration executed successfully!');
        console.log('\nChanges:');
        console.log('  - Added visibility column (private/team/community)');
        console.log('  - Added user_id column');
        console.log('  - Added team_slug column');
        console.log('  - Added created_at/updated_at timestamps');
        console.log('  - Created indexes for better query performance');
        console.log('  - Existing templates set as "community"');

        client.release();
        await pool.end();

        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

runMigration();

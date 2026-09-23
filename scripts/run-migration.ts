//Script para ejecutar la migración desde Node.js
//Alternativa a psql para Windows

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();

    try {
        console.log('🔄 Ejecutando migración 005_onboarding_and_templates.sql...\n');

        const migrationPath = path.join(__dirname, '..', 'migrations', '005_onboarding_and_templates.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        await client.query(sql);

        console.log('✅ Migración completada exitosamente!\n');
        console.log('Tablas creadas:');
        console.log('  - pn_user_onboarding');
        console.log('  - pn_assistant_templates');
        console.log('  - pn_user_favorite_templates\n');

    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('🎉 Todo listo! Ahora puedes ejecutar el seed:');
        console.log('   npx tsx scripts/seed-templates.ts\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migración falló:', error);
        process.exit(1);
    });

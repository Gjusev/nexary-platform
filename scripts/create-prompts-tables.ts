/**
 * Script de migración para crear las tablas de la biblioteca de prompts
 * 
 * Uso:
 * node scripts/create-prompts-tables.js
 * 
 * O con ts-node:
 * npx ts-node scripts/create-prompts-tables.ts
 */

import { query } from '../lib/db';
import { ensurePromptsTable } from '../lib/prompts-schema';

async function runMigration() {
  console.log('🚀 Iniciando migración de tablas de prompts...\n');

  try {
    // Crear las tablas
    await ensurePromptsTable();
    
    console.log('✅ Tablas creadas exitosamente!\n');
    console.log('Tablas creadas:');
    console.log('  - projectnexus.prompts');
    console.log('  - projectnexus.user_favorite_prompts\n');
    
    // Verificar que las tablas existen
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'projectnexus' 
      AND table_name IN ('prompts', 'user_favorite_prompts')
      ORDER BY table_name
    `);
    
    console.log('📊 Verificación de tablas:');
    result.rows.forEach((row: any) => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    console.log('\n✨ Migración completada con éxito!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
runMigration();

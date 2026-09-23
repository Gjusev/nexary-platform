// Script para ejecutar la migración de base de datos
// ===================================================
// Este script añade las columnas necesarias para el selector de modelos

import { query } from '../lib/db';

async function runMigration() {
    try {
        console.log('🔄 Ejecutando migración de base de datos...');

        // Añadir columnas si no existen
        await query(`
      ALTER TABLE pn_chat_conversations 
      ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'openai',
      ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gpt-4o-mini',
      ADD COLUMN IF NOT EXISTS use_smart_selector BOOLEAN DEFAULT false;
    `);

        console.log('✅ Migración completada exitosamente!');
        console.log('   - Columna "provider" añadida');
        console.log('   - Columna "model" añadida');
        console.log('   - Columna "use_smart_selector" añadida');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
}

runMigration();

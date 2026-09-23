import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde .env.local primero, luego .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { initializeTables } from '@/lib/db';

async function runMigrations() {
  try {
    console.log('Iniciando migración de la base de datos...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Configurado' : '✗ No encontrado');
    await initializeTables();
    console.log('✅ Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
/**
 * Script de migración para crear las tablas de la biblioteca de prompts
 * 
 * Uso:
 * node scripts/create-prompts-tables.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function createPromptsTables() {
  console.log('🚀 Iniciando migración de tablas de prompts...\n');

  try {
    // Crear extensión pgcrypto si no existe
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    
    // Crear schema si no existe
    await pool.query(`CREATE SCHEMA IF NOT EXISTS projectnexus`);

    // Crear tabla de prompts
    console.log('📝 Creando tabla prompts...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projectnexus.prompts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        
        -- Visibility levels: 'private', 'team', 'community'
        visibility VARCHAR(20) NOT NULL DEFAULT 'private',
        
        -- Owner information
        user_id TEXT NOT NULL,
        username TEXT,
        
        -- Team information (null for private and community prompts)
        team_slug TEXT,
        
        -- Metadata
        category VARCHAR(100),
        tags TEXT[], -- Array of tags
        
        -- Usage stats
        usage_count INTEGER DEFAULT 0,
        favorite_count INTEGER DEFAULT 0,
        
        -- Timestamps
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'team', 'community')),
        CONSTRAINT team_required_for_team_visibility CHECK (
          (visibility = 'team' AND team_slug IS NOT NULL) OR 
          (visibility != 'team')
        )
      )
    `);
    console.log('  ✓ Tabla prompts creada\n');

    // Crear índices
    console.log('📇 Creando índices...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON projectnexus.prompts(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prompts_team_slug ON projectnexus.prompts(team_slug)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prompts_visibility ON projectnexus.prompts(visibility)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prompts_category ON projectnexus.prompts(category)
    `);
    console.log('  ✓ Índices creados\n');

    // Crear tabla de favoritos
    console.log('⭐ Creando tabla user_favorite_prompts...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projectnexus.user_favorite_prompts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        prompt_id UUID NOT NULL REFERENCES projectnexus.prompts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, prompt_id)
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_favorite_prompts_user_id 
      ON projectnexus.user_favorite_prompts(user_id)
    `);
    console.log('  ✓ Tabla user_favorite_prompts creada\n');

    // Insertar prompts de ejemplo (opcional)
    console.log('📚 Insertando prompts de ejemplo...');
    await pool.query(`
      INSERT INTO projectnexus.prompts (title, content, description, visibility, user_id, username, category, tags)
      VALUES 
        (
          'Code Review Prompt',
          'Bitte überprüfe den folgenden Code und gib mir konstruktives Feedback zu:
1. Code-Qualität und Best Practices
2. Potenzielle Bugs oder Fehler
3. Verbesserungsmöglichkeiten für Performance
4. Sicherheitsaspekte

[Code hier einfügen]',
          'Ein umfassender Prompt für Code-Reviews',
          'community',
          'system',
          'System',
          'Code',
          ARRAY['code', 'review', 'quality']
        ),
        (
          'Dokumentations-Zusammenfassung',
          'Analysiere das folgende Dokument und erstelle eine strukturierte Zusammenfassung mit:
- Hauptthemen und Kernaussagen
- Wichtigste Punkte
- Handlungsempfehlungen
- Offene Fragen

[Dokument hier einfügen]',
          'Erstellt strukturierte Zusammenfassungen von Dokumenten',
          'community',
          'system',
          'System',
          'Analyse',
          ARRAY['dokumentation', 'zusammenfassung', 'analyse']
        ),
        (
          'Bug Report Template',
          'Erstelle einen detaillierten Bug-Report mit folgenden Informationen:

**Beschreibung:**
[Was ist das Problem?]

**Schritte zur Reproduktion:**
1. 
2. 
3. 

**Erwartetes Verhalten:**
[Was sollte passieren?]

**Tatsächliches Verhalten:**
[Was passiert wirklich?]

**Umgebung:**
- OS:
- Browser/Version:
- Weitere relevante Details:

**Screenshots/Logs:**
[Falls verfügbar]',
          'Strukturierte Vorlage für Bug-Reports',
          'community',
          'system',
          'System',
          'Development',
          ARRAY['bug', 'template', 'reporting']
        )
      ON CONFLICT DO NOTHING
    `);
    console.log('  ✓ 3 prompts de ejemplo insertados\n');

    // Verificar las tablas creadas
    console.log('🔍 Verificando tablas...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'projectnexus' 
      AND table_name IN ('prompts', 'user_favorite_prompts')
      ORDER BY table_name
    `);
    
    console.log('📊 Tablas verificadas:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    console.log('\n✨ ¡Migración completada con éxito!\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    await pool.end();
    process.exit(1);
  }
}

// Ejecutar la migración
createPromptsTables();

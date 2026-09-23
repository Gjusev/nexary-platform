-- Migration: Add prompts library tables
-- Date: 2025-10-10
-- Description: Creates tables for prompt library with private, team, and community visibility levels

-- Create prompts table
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
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON projectnexus.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_team_slug ON projectnexus.prompts(team_slug);
CREATE INDEX IF NOT EXISTS idx_prompts_visibility ON projectnexus.prompts(visibility);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON projectnexus.prompts(category);

-- Create user favorite prompts table
CREATE TABLE IF NOT EXISTS projectnexus.user_favorite_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  prompt_id UUID NOT NULL REFERENCES projectnexus.prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_prompts_user_id 
ON projectnexus.user_favorite_prompts(user_id);

-- Insert some sample prompts for testing (optional)
INSERT INTO projectnexus.prompts (title, content, description, visibility, user_id, username, category, tags)
VALUES 
  (
    'Code Review Prompt',
    'Bitte überprüfe den folgenden Code und gib mir konstruktives Feedback zu:\n1. Code-Qualität und Best Practices\n2. Potenzielle Bugs oder Fehler\n3. Verbesserungsmöglichkeiten für Performance\n4. Sicherheitsaspekte\n\n[Code hier einfügen]',
    'Ein umfassender Prompt für Code-Reviews',
    'community',
    'system',
    'System',
    'Code',
    ARRAY['code', 'review', 'quality']
  ),
  (
    'Dokumentations-Zusammenfassung',
    'Analysiere das folgende Dokument und erstelle eine strukturierte Zusammenfassung mit:\n- Hauptthemen und Kernaussagen\n- Wichtigste Punkte\n- Handlungsempfehlungen\n- Offene Fragen\n\n[Dokument hier einfügen]',
    'Erstellt strukturierte Zusammenfassungen von Dokumenten',
    'community',
    'system',
    'System',
    'Analyse',
    ARRAY['dokumentation', 'zusammenfassung', 'analyse']
  ),
  (
    'Bug Report Template',
    'Erstelle einen detaillierten Bug-Report mit folgenden Informationen:\n\n**Beschreibung:**\n[Was ist das Problem?]\n\n**Schritte zur Reproduktion:**\n1. \n2. \n3. \n\n**Erwartetes Verhalten:**\n[Was sollte passieren?]\n\n**Tatsächliches Verhalten:**\n[Was passiert wirklich?]\n\n**Umgebung:**\n- OS:\n- Browser/Version:\n- Weitere relevante Details:\n\n**Screenshots/Logs:**\n[Falls verfügbar]',
    'Strukturierte Vorlage für Bug-Reports',
    'community',
    'system',
    'System',
    'Development',
    ARRAY['bug', 'template', 'reporting']
  )
ON CONFLICT DO NOTHING;

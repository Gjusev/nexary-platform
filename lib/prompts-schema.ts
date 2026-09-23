import { query } from './db';

export async function ensurePromptsTable() {
  await query(`
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

  // Índices para búsqueda eficiente
  await query(`
    CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON projectnexus.prompts(user_id);
  `);
  
  await query(`
    CREATE INDEX IF NOT EXISTS idx_prompts_team_slug ON projectnexus.prompts(team_slug);
  `);
  
  await query(`
    CREATE INDEX IF NOT EXISTS idx_prompts_visibility ON projectnexus.prompts(visibility);
  `);
  
  await query(`
    CREATE INDEX IF NOT EXISTS idx_prompts_category ON projectnexus.prompts(category);
  `);

  // Tabla para prompts favoritos de usuarios
  await query(`
    CREATE TABLE IF NOT EXISTS projectnexus.user_favorite_prompts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      prompt_id UUID NOT NULL REFERENCES projectnexus.prompts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, prompt_id)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_favorite_prompts_user_id 
    ON projectnexus.user_favorite_prompts(user_id);
  `);
}

export type PromptVisibility = 'private' | 'team' | 'community';

export interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  visibility: PromptVisibility;
  user_id: string;
  username?: string;
  team_slug?: string;
  category?: string;
  tags?: string[];
  usage_count: number;
  favorite_count: number;
  created_at: Date;
  updated_at: Date;
  is_favorite?: boolean; // Calculated field
}

-- Migration 006: Add visibility and user ownership to assistant templates
-- Allows personal, team, and community templates like prompts

-- Add visibility column (default to 'community' for existing templates)
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'community' CHECK (visibility IN ('private', 'team', 'community'));

-- Add user_id for ownership
ALTER TABLE pn_assistant_templates
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add team_slug for team templates
ALTER TABLE pn_assistant_templates
ADD COLUMN IF NOT EXISTS team_slug TEXT;

-- Add created_at and updated_at timestamps
ALTER TABLE pn_assistant_templates
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE pn_assistant_templates
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assistant_templates_visibility ON pn_assistant_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_assistant_templates_user_id ON pn_assistant_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_templates_team_slug ON pn_assistant_templates(team_slug);

-- Update existing templates to be community templates (no user_id)
UPDATE pn_assistant_templates SET visibility = 'community' WHERE user_id IS NULL;

COMMENT ON COLUMN pn_assistant_templates.visibility IS 'Template visibility: private (user only), team (team members), community (everyone)';
COMMENT ON COLUMN pn_assistant_templates.user_id IS 'Stack Auth user ID of template creator';
COMMENT ON COLUMN pn_assistant_templates.team_slug IS 'Team slug for team visibility templates';

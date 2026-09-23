-- Migration 005: Onboarding and Assistant Templates
-- Purpose: Add tables for user onboarding tracking and assistant template marketplace
-- Author: Antigravity AI
-- Date: 2024-12-24

-- ============================================
-- Table: pn_user_onboarding
-- Purpose: Track onboarding progress per user
-- ============================================
CREATE TABLE IF NOT EXISTS pn_user_onboarding (
    user_id TEXT PRIMARY KEY,  -- Stack Auth user ID - no FK constraint
    completed BOOLEAN DEFAULT FALSE,
    current_step INTEGER DEFAULT 0,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    badges JSONB DEFAULT '[]'::jsonb,
    skipped BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for querying users who haven't completed onboarding
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed 
ON pn_user_onboarding(completed) 
WHERE completed = FALSE;

-- Index for tracking when users complete onboarding
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed_at 
ON pn_user_onboarding(completed_at);

-- ============================================
-- Table: pn_assistant_templates
-- Purpose: Store pre-configured AI assistant templates
-- ============================================
CREATE TABLE IF NOT EXISTS pn_assistant_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'legal', 'finance', 'hr', 'sales', 'tech', 'support', 'research', 'marketing', 'data', 'project'
    icon TEXT, -- lucide-react icon name
    system_prompt TEXT NOT NULL,
    sample_prompts JSONB DEFAULT '[]'::jsonb, -- Array of example questions
    tags JSONB DEFAULT '[]'::jsonb, -- Searchable tags
    is_featured BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT, -- Stack Auth user ID - no FK constraint (nullable for system templates)
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_templates_category 
ON pn_assistant_templates(category);

-- Index for featured templates
CREATE INDEX IF NOT EXISTS idx_templates_featured 
ON pn_assistant_templates(is_featured) 
WHERE is_featured = TRUE;

-- Index for searching templates
CREATE INDEX IF NOT EXISTS idx_templates_name 
ON pn_assistant_templates USING gin(to_tsvector('english', name));

-- Index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_templates_usage_count 
ON pn_assistant_templates(usage_count DESC);

-- ============================================
-- Table: pn_user_favorite_templates
-- Purpose: User's favorite templates (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS pn_user_favorite_templates (
    user_id TEXT,  -- Stack Auth user ID - no FK constraint
    template_id UUID,
    favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, template_id),
    FOREIGN KEY (template_id) REFERENCES pn_assistant_templates(id) ON DELETE CASCADE
);

-- Index for querying favorites per user
CREATE INDEX IF NOT EXISTS idx_user_favorites_user 
ON pn_user_favorite_templates(user_id);

-- Index for counting favorites per template
CREATE INDEX IF NOT EXISTS idx_user_favorites_template 
ON pn_user_favorite_templates(template_id);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE pn_user_onboarding IS 'Tracks user onboarding wizard progress and completion';
COMMENT ON TABLE pn_assistant_templates IS 'Pre-configured AI assistant templates for the marketplace';
COMMENT ON TABLE pn_user_favorite_templates IS 'User favorite templates (many-to-many relationship)';

COMMENT ON COLUMN pn_user_onboarding.completed_steps IS 'Array of step numbers completed [1,2,3,4]';
COMMENT ON COLUMN pn_user_onboarding.badges IS 'Array of earned badges ["onboarding_master", "early_adopter"]';
COMMENT ON COLUMN pn_assistant_templates.sample_prompts IS 'Array of example prompts: ["Analyze this contract", "What are the key risks?"]';
COMMENT ON COLUMN pn_assistant_templates.tags IS 'Searchable tags: ["legal", "contracts", "compliance"]';

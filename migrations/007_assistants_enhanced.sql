-- Migration 007: Enhanced Assistants Features
-- Purpose: Add new fields to differentiate assistants from prompts library
-- Author: Antigravity AI
-- Date: 2024-12-25

-- ============================================
-- Add welcome message for personalized greetings
-- ============================================
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- ============================================
-- Add avatar customization
-- ============================================
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#6366f1';

-- ============================================
-- Add preferred AI model
-- ============================================
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS preferred_model TEXT;

-- ============================================
-- Add conversation counter for statistics
-- ============================================
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS conversation_count INTEGER DEFAULT 0;

-- ============================================
-- Add context questions (questions assistant asks before starting task)
-- ============================================
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS context_questions JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- Add RAG container association (for future use)
-- ============================================
ALTER TABLE pn_assistant_templates 
ADD COLUMN IF NOT EXISTS rag_container_id UUID;

-- ============================================
-- Indexes for new fields
-- ============================================
CREATE INDEX IF NOT EXISTS idx_assistant_templates_preferred_model 
ON pn_assistant_templates(preferred_model) WHERE preferred_model IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_templates_rag_container 
ON pn_assistant_templates(rag_container_id) WHERE rag_container_id IS NOT NULL;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN pn_assistant_templates.welcome_message IS 'Personalized greeting shown when starting chat with assistant';
COMMENT ON COLUMN pn_assistant_templates.avatar_color IS 'Hex color for avatar background customization';
COMMENT ON COLUMN pn_assistant_templates.preferred_model IS 'Preferred AI model (e.g., gpt-4o, claude-3-5-sonnet)';
COMMENT ON COLUMN pn_assistant_templates.conversation_count IS 'Number of conversations started with this assistant';
COMMENT ON COLUMN pn_assistant_templates.context_questions IS 'Array of questions assistant asks before starting the task: ["What is your budget?", "What is the deadline?"]';
COMMENT ON COLUMN pn_assistant_templates.rag_container_id IS 'Associated RAG container for knowledge-augmented assistants (future feature)';

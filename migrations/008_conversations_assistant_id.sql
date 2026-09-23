-- Migration: Add assistant_id to chat_conversations
-- This links a conversation to an AI assistant template

ALTER TABLE projectnexus.chat_conversations
ADD COLUMN IF NOT EXISTS assistant_id UUID REFERENCES pn_assistant_templates(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_conversations_assistant_id 
ON projectnexus.chat_conversations(assistant_id) 
WHERE assistant_id IS NOT NULL;

COMMENT ON COLUMN projectnexus.chat_conversations.assistant_id IS 'Links conversation to an AI assistant template';

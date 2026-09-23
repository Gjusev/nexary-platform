import { query } from '@/lib/db';

export async function createChatTables(): Promise<void> {
  // Create conversations table
  await query(`
    CREATE TABLE IF NOT EXISTS pn_chat_conversations (
      id VARCHAR(255) PRIMARY KEY,
      slug VARCHAR(255) UNIQUE NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      team_slug VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      rag_package_ids TEXT[] DEFAULT '{}',
      provider VARCHAR(50) DEFAULT 'openai',
      model VARCHAR(100) DEFAULT 'gpt-4o-mini',
      use_smart_selector BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add new columns to existing table if they don't exist
  await query(`
    ALTER TABLE pn_chat_conversations 
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'openai',
    ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    ADD COLUMN IF NOT EXISTS use_smart_selector BOOLEAN DEFAULT false;
  `);

  // Create messages table
  await query(`
    CREATE TABLE IF NOT EXISTS pn_chat_messages (
      id VARCHAR(255) PRIMARY KEY,
      conversation_id VARCHAR(255) NOT NULL REFERENCES pn_chat_conversations(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for better performance
  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_email ON pn_chat_conversations(user_email);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_team_slug ON pn_chat_conversations(team_slug);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON pn_chat_conversations(updated_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON pn_chat_messages(conversation_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON pn_chat_messages(created_at DESC);`);

  // Create trigger to update updated_at on conversations
  await query(`
    CREATE OR REPLACE FUNCTION update_conversation_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE pn_chat_conversations 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.conversation_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await query(`
    DROP TRIGGER IF EXISTS trigger_update_conversation_updated_at ON pn_chat_messages;
    CREATE TRIGGER trigger_update_conversation_updated_at
      AFTER INSERT ON pn_chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_conversation_updated_at();
  `);

  }

// Initialize tables automatically when this module is imported
createChatTables().catch(console.error);
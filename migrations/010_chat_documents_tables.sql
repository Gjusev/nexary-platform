-- Migration: Add chat_documents and chat_embeddings tables
-- This enables document upload and RAG functionality for chat conversations

-- Table: chat_documents
-- Stores uploaded documents (PDF, Excel) for chat conversations
CREATE TABLE IF NOT EXISTS projectnexus.chat_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES projectnexus.chat_conversations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  user_email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chat_documents
CREATE INDEX IF NOT EXISTS idx_chat_documents_conversation ON projectnexus.chat_documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_documents_user_email ON projectnexus.chat_documents(user_email);
CREATE INDEX IF NOT EXISTS idx_chat_documents_created_at ON projectnexus.chat_documents(created_at DESC);

-- Table: chat_embeddings
-- Stores vector embeddings for document chunks (RAG)
CREATE TABLE IF NOT EXISTS projectnexus.chat_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES projectnexus.chat_documents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES projectnexus.chat_conversations(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chat_embeddings
CREATE INDEX IF NOT EXISTS idx_chat_embeddings_document ON projectnexus.chat_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_embeddings_conversation ON projectnexus.chat_embeddings(conversation_id);

-- Vector similarity search index (requires pgvector extension)
-- This enables efficient vector similarity searches for RAG
CREATE INDEX IF NOT EXISTS idx_chat_embeddings_embedding_vector
ON projectnexus.chat_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Comments
COMMENT ON TABLE projectnexus.chat_documents IS 'Stores uploaded documents for chat conversations';
COMMENT ON TABLE projectnexus.chat_embeddings IS 'Stores vector embeddings for RAG document chunks';
COMMENT ON COLUMN projectnexus.chat_embeddings.embedding IS 'Vector embedding (3072 dimensions for OpenAI text-embedding-3-large)';

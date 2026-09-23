import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import type { AIProvider } from '@/lib/ai-providers';

function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  const uniqueSuffix = randomUUID().slice(0, 8);
  return `${baseSlug}-${uniqueSuffix}`;
}

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  /** Images attached to the message (for multi-modal chat) */
  images?: MessageImage[];
};

/**
 * Image data structure for multi-modal chat messages
 */
export type MessageImage = {
  /** Base64 data URL (data:image/...) */
  dataUrl: string;
  /** Original file name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type (image/jpeg, image/png, etc.) */
  type: string;
  /** Width in pixels (optional, if available) */
  width?: number;
  /** Height in pixels (optional, if available) */
  height?: number;
};

export type ChatConversation = {
  id: string;
  slug: string;
  title: string;
  userEmail: string;
  teamSlug: string;
  ragPackageIds: string[];
  provider: AIProvider;
  model: string;
  useSmartSelector: boolean;
  assistantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessage[];
  hasMoreMessages?: boolean;
};

export type ConversationMessagesOptions = {
  limit?: number;
  before?: string | Date;
};

type ConversationMessagesResult = {
  messages: ChatMessage[];
  hasMore: boolean;
};

/**
 * Options for listing conversations with pagination.
 */
export type ListConversationsOptions = {
  /** Maximum number of conversations to return (default: 20, max: 100) */
  limit?: number;
  /** Number of conversations to skip (for pagination) */
  offset?: number;
};

/**
 * Result of listing conversations with pagination info.
 */
export type ListConversationsResult = {
  conversations: ChatConversation[];
  /** Whether there are more conversations available */
  hasMore: boolean;
  /** Total count of conversations (optional, can be expensive) */
  totalCount?: number;
};

async function fetchConversationMessages(
  conversationId: string,
  options?: ConversationMessagesOptions
): Promise<ConversationMessagesResult> {
  const sanitizedLimit = options?.limit
    ? Math.max(1, Math.min(options.limit, 100))
    : undefined;

  const params: (string | number | Date)[] = [conversationId];
  let queryText = `SELECT id, conversation_id, role, content, metadata, created_at
     FROM projectnexus.chat_messages
     WHERE conversation_id = $1`;

  if (options?.before) {
    const beforeDate = options.before instanceof Date
      ? options.before
      : new Date(options.before);
    if (!Number.isNaN(beforeDate.getTime())) {
      params.push(beforeDate);
      queryText += ` AND created_at < $${params.length}`;
    }
  }

  queryText += ' ORDER BY created_at DESC';

  if (sanitizedLimit) {
    params.push(sanitizedLimit + 1);
    queryText += ` LIMIT $${params.length}`;
  }

  const { rows: messageRows } = await query<{
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(queryText, params);

  let hasMore = false;
  let rows = messageRows;

  if (sanitizedLimit && messageRows.length > sanitizedLimit) {
    hasMore = true;
    rows = messageRows.slice(0, sanitizedLimit);
  }

  const messages: ChatMessage[] = rows
    .map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as ChatMessage['role'],
      content: row.content,
      metadata: row.metadata,
      createdAt: row.created_at,
    }))
    .reverse();

  return { messages, hasMore };
}

export type CreateConversationInput = {
  userEmail: string;
  teamSlug: string;
  title: string;
  ragPackageIds?: string[];
  provider?: AIProvider;
  model?: string;
  useSmartSelector?: boolean;
  assistantId?: string | null;
};

export type CreateMessageInput = {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  /** Images attached to the message (for multi-modal chat) */
  images?: MessageImage[];
};

/**
 * Creates a new chat conversation with the specified parameters.
 *
 * @param input - Configuration for the new conversation
 * @param input.userEmail - Email of the user creating the conversation
 * @param input.teamSlug - Team slug for the conversation
 * @param input.title - Display title for the conversation
 * @param input.ragPackageIds - Optional array of RAG package IDs to associate
 * @param input.provider - AI provider to use (default: 'openai')
 * @param input.model - Model to use (default: 'gpt-4o-mini')
 * @param input.useSmartSelector - Whether to use smart RAG selector (default: false)
 * @param input.assistantId - Optional assistant ID to associate
 * @returns The created conversation object
 * @throws {Error} When database operation fails
 *
 * @example
 * ```typescript
 * const conversation = await createConversation({
 *   userEmail: 'user@example.com',
 *   teamSlug: 'my-team',
 *   title: 'My Chat',
 *   ragPackageIds: ['pkg-1', 'pkg-2'],
 *   provider: 'openai',
 *   model: 'gpt-4o-mini'
 * });
 * ```
 */
export async function createConversation(input: CreateConversationInput): Promise<ChatConversation> {
  const id = randomUUID();
  const slug = generateSlug(input.title);
  const ragPackageIds = input.ragPackageIds || [];
  const provider = input.provider || 'openai';
  const model = input.model || 'gpt-4o-mini';
  const useSmartSelector = input.useSmartSelector ?? false;
  const assistantId = input.assistantId || null;

  const { rows } = await query<{
    id: string;
    slug: string;
    title: string;
    user_email: string;
    team_slug: string;
    rag_package_ids: string[];
    provider: string;
    model: string;
    use_smart_selector: boolean;
    assistant_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO projectnexus.chat_conversations (id, slug, title, user_email, team_slug, rag_package_ids, provider, model, use_smart_selector, assistant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, slug, title, user_email, team_slug, rag_package_ids, provider, model, use_smart_selector, assistant_id, created_at, updated_at`,
    [id, slug, input.title, input.userEmail, input.teamSlug, ragPackageIds, provider, model, useSmartSelector, assistantId]
  );

  const row = rows[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    userEmail: row.user_email,
    teamSlug: row.team_slug,
    ragPackageIds: row.rag_package_ids,
    provider: row.provider as AIProvider,
    model: row.model,
    useSmartSelector: row.use_smart_selector,
    assistantId: row.assistant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List conversations for a user with optional pagination.
 *
 * @param userEmail - User's email address
 * @param teamSlug - Team slug
 * @param options - Pagination options
 * @returns Conversations with pagination metadata
 */
export async function listConversations(
  userEmail: string,
  teamSlug: string,
  options?: ListConversationsOptions
): Promise<ListConversationsResult> {
  // Default limit of 20, max of 100
  const limit = options?.limit
    ? Math.max(1, Math.min(options.limit, 100))
    : 20;
  const offset = options?.offset || 0;

  // Fetch one extra to determine if there are more results
  const fetchLimit = limit + 1;

  const { rows } = await query<{
    id: string;
    slug: string;
    title: string;
    user_email: string;
    team_slug: string;
    rag_package_ids: string[];
    provider: string;
    model: string;
    use_smart_selector: boolean;
    assistant_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, slug, title, user_email, team_slug, rag_package_ids, provider, model, use_smart_selector, assistant_id, created_at, updated_at
     FROM projectnexus.chat_conversations
     WHERE user_email = $1 AND team_slug = $2 AND title NOT LIKE '[DELETED]%'
     ORDER BY updated_at DESC
     LIMIT $3 OFFSET $4`,
    [userEmail, teamSlug, fetchLimit, offset]
  );

  const hasMore = rows.length > limit;
  const conversations = rows.slice(0, limit).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    userEmail: row.user_email,
    teamSlug: row.team_slug,
    ragPackageIds: row.rag_package_ids,
    provider: row.provider as AIProvider,
    model: row.model,
    useSmartSelector: row.use_smart_selector,
    assistantId: row.assistant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    conversations,
    hasMore,
  };
}

/**
 * Legacy version of listConversations for backward compatibility.
 * Returns only the conversations array without pagination metadata.
 *
 * @deprecated Use listConversations with options instead
 */
export async function listConversationsLegacy(
  userEmail: string,
  teamSlug: string
): Promise<ChatConversation[]> {
  const result = await listConversations(userEmail, teamSlug);
  return result.conversations;
}

/**
 * Retrieves a conversation by ID with optional message pagination.
 *
 * @param id - The conversation ID to retrieve
 * @param userEmail - Email of the user who owns the conversation
 * @param options - Optional pagination parameters for messages
 * @param options.limit - Maximum number of messages to return (max: 100)
 * @param options.before - Return messages before this timestamp
 * @returns The conversation with messages, or null if not found
 * @throws {Error} When database operation fails
 *
 * @example
 * ```typescript
 * const conversation = await getConversation('conv-id', 'user@example.com', {
 *   limit: 50,
 *   before: new Date('2024-01-01')
 * });
 * ```
 */
export async function getConversation(
  id: string,
  userEmail: string,
  options?: ConversationMessagesOptions
): Promise<ChatConversation | null> {
  const { rows: conversationRows } = await query<{
    id: string;
    slug: string;
    title: string;
    user_email: string;
    team_slug: string;
    rag_package_ids: string[];
    provider: string;
    model: string;
    use_smart_selector: boolean;
    assistant_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, slug, title, user_email, team_slug, rag_package_ids, provider, model, use_smart_selector, assistant_id, created_at, updated_at
     FROM projectnexus.chat_conversations
     WHERE id = $1 AND user_email = $2
     LIMIT 1`,
    [id, userEmail]
  );

  if (conversationRows.length === 0) {
    return null;
  }

  const conversation = conversationRows[0];

  const { messages, hasMore } = await fetchConversationMessages(conversation.id, options);

  return {
    id: conversation.id,
    slug: conversation.slug,
    title: conversation.title,
    userEmail: conversation.user_email,
    teamSlug: conversation.team_slug,
    ragPackageIds: conversation.rag_package_ids,
    provider: conversation.provider as AIProvider,
    model: conversation.model,
    useSmartSelector: conversation.use_smart_selector,
    assistantId: conversation.assistant_id,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages,
    hasMoreMessages: hasMore,
  };
}

/**
 * Retrieves a conversation by its slug with optional message pagination.
 *
 * @param slug - The conversation slug to retrieve
 * @param userEmail - Email of the user who owns the conversation
 * @param options - Optional pagination parameters for messages
 * @param options.limit - Maximum number of messages to return (max: 100)
 * @param options.before - Return messages before this timestamp
 * @returns The conversation with messages, or null if not found
 * @throws {Error} When database operation fails
 *
 * @example
 * ```typescript
 * const conversation = await getConversationBySlug('my-conversation', 'user@example.com');
 * ```
 */
export async function getConversationBySlug(
  slug: string,
  userEmail: string,
  options?: ConversationMessagesOptions
): Promise<ChatConversation | null> {
  const { rows: conversationRows } = await query<{
    id: string;
    slug: string;
    title: string;
    user_email: string;
    team_slug: string;
    rag_package_ids: string[];
    provider: string;
    model: string;
    use_smart_selector: boolean;
    assistant_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, slug, title, user_email, team_slug, rag_package_ids, provider, model, use_smart_selector, assistant_id, created_at, updated_at
     FROM projectnexus.chat_conversations
     WHERE slug = $1 AND user_email = $2
     LIMIT 1`,
    [slug, userEmail]
  );

  if (conversationRows.length === 0) {
    return null;
  }

  const conversation = conversationRows[0];

  const { messages, hasMore } = await fetchConversationMessages(conversation.id, options);

  return {
    id: conversation.id,
    slug: conversation.slug,
    title: conversation.title,
    userEmail: conversation.user_email,
    teamSlug: conversation.team_slug,
    ragPackageIds: conversation.rag_package_ids,
    provider: conversation.provider as AIProvider,
    model: conversation.model,
    useSmartSelector: conversation.use_smart_selector,
    assistantId: conversation.assistant_id,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages,
    hasMoreMessages: hasMore,
  };
}

/**
 * Adds a new message to a conversation and updates the conversation's timestamp.
 *
 * @param input - Message creation parameters
 * @param input.conversationId - ID of the conversation to add the message to
 * @param input.role - Message role: 'user', 'assistant', or 'system'
 * @param input.content - Message content
 * @param input.metadata - Optional metadata to attach to the message
 * @returns The created message object
 * @throws {Error} When database operation fails
 *
 * @example
 * ```typescript
 * const message = await addMessage({
 *   conversationId: 'conv-id',
 *   role: 'user',
 *   content: 'Hello, world!',
 *   metadata: { sources: [...] }
 * });
 * ```
 */
export async function addMessage(input: CreateMessageInput): Promise<ChatMessage> {
  const id = randomUUID();
  const metadata = input.metadata ?? {};

  // Include images in metadata for storage
  const metadataWithImages = input.images && input.images.length > 0
    ? { ...metadata, images: input.images }
    : metadata;

  const { rows } = await query<{
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    `INSERT INTO projectnexus.chat_messages (id, conversation_id, role, content, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, conversation_id, role, content, metadata, created_at`,
    [id, input.conversationId, input.role, input.content, JSON.stringify(metadataWithImages)]
  );

  // Update conversation's updated_at timestamp
  await query(
    `UPDATE projectnexus.chat_conversations SET updated_at = NOW() WHERE id = $1`,
    [input.conversationId]
  );

  const row = rows[0];
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    metadata: row.metadata,
    images: (row.metadata.images as MessageImage[] | undefined),
    createdAt: row.created_at,
  };
}

/**
 * Updates a conversation's properties.
 *
 * @param id - ID of the conversation to update
 * @param userEmail - Email of the user who owns the conversation
 * @param updates - Partial updates to apply to the conversation
 * @param updates.title - New title for the conversation
 * @param updates.ragPackageIds - New array of RAG package IDs
 * @param updates.provider - New AI provider
 * @param updates.model - New model
 * @param updates.useSmartSelector - New smart selector setting
 * @returns The updated conversation, or null if not found
 * @throws {Error} When database operation fails
 *
 * @example
 * ```typescript
 * const updated = await updateConversation('conv-id', 'user@example.com', {
 *   title: 'Updated Title',
 *   ragPackageIds: ['pkg-1']
 * });
 * ```
 */
export async function updateConversation(
  id: string,
  userEmail: string,
  updates: Partial<Pick<ChatConversation, 'title' | 'ragPackageIds' | 'provider' | 'model' | 'useSmartSelector'>>
): Promise<ChatConversation | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];
  let paramCount = 0;

  if (updates.title !== undefined) {
    setParts.push(`title = $${++paramCount}`);
    values.push(updates.title);
  }

  if (updates.ragPackageIds !== undefined) {
    setParts.push(`rag_package_ids = $${++paramCount}`);
    values.push(updates.ragPackageIds);
  }

  if (updates.provider !== undefined) {
    setParts.push(`provider = $${++paramCount}`);
    values.push(updates.provider);
  }

  if (updates.model !== undefined) {
    setParts.push(`model = $${++paramCount}`);
    values.push(updates.model);
  }

  if (updates.useSmartSelector !== undefined) {
    setParts.push(`use_smart_selector = $${++paramCount}`);
    values.push(updates.useSmartSelector);
  }

  if (setParts.length === 0) {
    return null;
  }

  setParts.push(`updated_at = NOW()`);
  values.push(id, userEmail);

  const { rows } = await query<{
    id: string;
    slug: string;
    title: string;
    user_email: string;
    team_slug: string;
    rag_package_ids: string[];
    provider: string;
    model: string;
    use_smart_selector: boolean;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE projectnexus.chat_conversations 
     SET ${setParts.join(', ')}
     WHERE id = $${paramCount + 1} AND user_email = $${paramCount + 2}
     RETURNING id, slug, title, user_email, team_slug, rag_package_ids, provider, model, use_smart_selector, created_at, updated_at`,
    values
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    userEmail: row.user_email,
    teamSlug: row.team_slug,
    ragPackageIds: row.rag_package_ids,
    provider: row.provider as AIProvider,
    model: row.model,
    useSmartSelector: row.use_smart_selector,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Soft-deletes a conversation by prefixing its title with [DELETED].
 *
 * The conversation is not removed from the database, just marked as deleted.
 * Already deleted conversations (title starting with [DELETED]) are not modified.
 *
 * @param id - ID of the conversation to delete
 * @param userEmail - Email of the user who owns the conversation
 * @returns true if the conversation was deleted, false if not found or already deleted
 * @throws {Error} When database operation fails
 *
 * @example
 * ```typescript
 * const deleted = await deleteConversation('conv-id', 'user@example.com');
 * if (deleted) {
 *   * }
 * ```
 */
export async function deleteConversation(id: string, userEmail: string): Promise<boolean> {
  // Mark conversation as deleted instead of hard delete
  const { rowCount } = await query(
    `UPDATE projectnexus.chat_conversations 
     SET updated_at = NOW(), title = CONCAT('[DELETED] ', title)
     WHERE id = $1 AND user_email = $2 AND title NOT LIKE '[DELETED]%'`,
    [id, userEmail]
  );

  return (rowCount ?? 0) > 0;
}
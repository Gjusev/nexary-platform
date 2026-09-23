import { query } from '@/lib/db';
import { randomUUID } from 'crypto';

export type Invitation = {
  id: string;
  teamSlug: string;
  email: string;
  role: 'member' | 'admin';
  token: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
  usedAt?: Date;
};

export type Chat = {
  id: string;
  teamSlug: string;
  userId: string;
  title: string;
  ragPackageIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type Message = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};

// Initialize database tables
export async function initializeTables(): Promise<void> {
  // Create invitations table
  await query(`
    CREATE TABLE IF NOT EXISTS invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'member',
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      used BOOLEAN DEFAULT FALSE,
      used_at TIMESTAMP
    );
  `);

  // Create chats table
  await query(`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      rag_package_ids TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create messages table
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create indexes
  await query(`
    CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
    CREATE INDEX IF NOT EXISTS idx_invitations_team_email ON invitations(team_slug, email);
    CREATE INDEX IF NOT EXISTS idx_chats_team_user ON chats(team_slug, user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
  `);
}

// Invitation functions
export async function createInvitation(teamSlug: string, email: string, role: 'member' | 'admin' = 'member'): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

  await query(
    `INSERT INTO invitations (team_slug, email, role, token, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamSlug, email, role, token, expiresAt]
  );

  return token;
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const { rows } = await query<any>(
    `SELECT id, team_slug, email, role, token, expires_at, created_at, used, used_at
     FROM invitations
     WHERE token = $1 AND used = FALSE AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    email: row.email,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    used: row.used,
    usedAt: row.used_at || undefined,
  };
}

export async function useInvitation(token: string): Promise<void> {
  await query(
    `UPDATE invitations 
     SET used = TRUE, used_at = NOW()
     WHERE token = $1`,
    [token]
  );
}

export async function listPendingInvitations(teamSlug: string): Promise<Invitation[]> {
  const { rows } = await query<any>(
    `SELECT id, team_slug, email, role, token, expires_at, created_at, used, used_at
     FROM invitations
     WHERE team_slug = $1 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [teamSlug]
  );

  return rows.map(row => ({
    id: row.id,
    teamSlug: row.team_slug,
    email: row.email,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    used: row.used,
    usedAt: row.used_at || undefined,
  }));
}

// Chat functions
export async function createChat(teamSlug: string, userId: string, title: string, ragPackageIds: string[] = []): Promise<Chat> {
  const { rows } = await query<any>(
    `INSERT INTO chats (team_slug, user_id, title, rag_package_ids)
     VALUES ($1, $2, $3, $4)
     RETURNING id, team_slug, user_id, title, rag_package_ids, created_at, updated_at`,
    [teamSlug, userId, title, ragPackageIds]
  );

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    title: row.title,
    ragPackageIds: row.rag_package_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUserChats(teamSlug: string, userId: string): Promise<Chat[]> {
  const { rows } = await query<any>(
    `SELECT id, team_slug, user_id, title, rag_package_ids, created_at, updated_at
     FROM chats
     WHERE team_slug = $1 AND user_id = $2
     ORDER BY updated_at DESC`,
    [teamSlug, userId]
  );

  return rows.map(row => ({
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    title: row.title,
    ragPackageIds: row.rag_package_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getChatById(chatId: string): Promise<Chat | null> {
  const { rows } = await query<any>(
    `SELECT id, team_slug, user_id, title, rag_package_ids, created_at, updated_at
     FROM chats
     WHERE id = $1
     LIMIT 1`,
    [chatId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    title: row.title,
    ragPackageIds: row.rag_package_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateChat(chatId: string, updates: { title?: string; ragPackageIds?: string[] }): Promise<void> {
  const setParts: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    setParts.push(`title = $${paramIndex}`);
    values.push(updates.title);
    paramIndex++;
  }

  if (updates.ragPackageIds !== undefined) {
    setParts.push(`rag_package_ids = $${paramIndex}`);
    values.push(updates.ragPackageIds);
    paramIndex++;
  }

  if (setParts.length === 0) return;

  setParts.push(`updated_at = NOW()`);
  values.push(chatId);

  await query(
    `UPDATE chats SET ${setParts.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

export async function deleteChat(chatId: string): Promise<void> {
  await query(`DELETE FROM chats WHERE id = $1`, [chatId]);
}

// Message functions
export async function addMessage(chatId: string, role: 'user' | 'assistant', content: string): Promise<Message> {
  const { rows } = await query<any>(
    `INSERT INTO messages (chat_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING id, chat_id, role, content, created_at`,
    [chatId, role, content]
  );

  // Update chat's updated_at timestamp
  await query(`UPDATE chats SET updated_at = NOW() WHERE id = $1`, [chatId]);

  const row = rows[0];
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
  const { rows } = await query<any>(
    `SELECT id, chat_id, role, content, created_at
     FROM messages
     WHERE chat_id = $1
     ORDER BY created_at ASC`,
    [chatId]
  );

  return rows.map(row => ({
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}
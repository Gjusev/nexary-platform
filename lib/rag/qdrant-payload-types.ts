/**
 * Enhanced Qdrant Payload Types
 * Extended payload structure with multi-source metadata and ACL support
 */

// Base types for Qdrant payloads
export interface BaseQdrantPayload {
  chunk_index: number;
  text: string;
  document_id: string;
  filename: string;
  created_at: string;
  tags?: string[];
  team_slug?: string;
  packageId?: string;
}

/**
 * Multi-source metadata
 */
export interface SourceMetadata {
  // Source identification
  source_type: 'file' | 'confluence' | 'notion' | 'sharepoint' | 'google_drive' | 'slack' | 'web' | 'database';
  external_document_id?: string;
  external_url?: string;
  external_updated_at?: string;

  // Author information
  author_name?: string;
  author_email?: string;
  author_id?: string;

  // Source-specific metadata
  confluence?: {
    space_key?: string;
    space_name?: string;
    page_id?: number;
    version?: number;
    ancestors?: Array<{ title: string; id: string }>;
  };

  notion?: {
    database_id?: string;
    parent_id?: string;
    parent_type?: 'page_id' | 'database_id' | 'workspace';
    created_time?: string;
    last_edited_time?: string;
  };

  sharepoint?: {
    library_name?: string;
    file_extension?: string;
    folder_path?: string;
    site_name?: string;
  };

  google_drive?: {
    folder_id?: string;
    folder_name?: string;
    mime_type?: string;
    file_extension?: string;
  };

  slack?: {
    channel_id?: string;
    channel_name?: string;
    thread_ts?: string;
    team_id?: string;
  };

  web?: {
    domain?: string;
    depth?: number;
    canonical_url?: string;
    og_image?: string;
  };

  database?: {
    table_name?: string;
    primary_key?: string;
    query?: string;
  };

  // Content metadata
  content_type?: string;
  language?: string;
  word_count?: number;
  char_count?: number;
}

/**
 * ACL information
 */
export interface AclInfo {
  // Permission flags
  read_users?: string[];
  read_teams?: string[];
  write_users?: string[];
  write_teams?: string[];
  admin_users?: string[];
  admin_teams?: string[];

  // Public/private flag
  public?: boolean;

  // Source-native ACLs
  source_permissions?: Array<{
    principal_id: string;
    principal_type: 'user' | 'group' | 'team';
    permission_level: 'read' | 'write' | 'admin' | 'owner';
    source_id?: string;
  }>;

  // Mapped internal ACLs
  mapped_acls?: Array<{
    internal_user_id?: string;
    internal_team_slug?: string;
    permission_level: 'read' | 'write' | 'admin';
  }>;
}

/**
 * Enhanced Qdrant payload with multi-source and ACL support
 */
export interface EnhancedQdrantPayload extends BaseQdrantPayload {
  // Multi-source metadata
  source?: SourceMetadata;

  // ACL information
  acl?: AclInfo;

  // External references
  external_document_id?: string;
  external_url?: string;

  // Document hierarchy
  parent_id?: string;
  ancestor_ids?: string[];

  // Document status
  status?: 'ready' | 'processing' | 'error' | 'deleted';

  // Quality metrics
  embedding_model?: string;
  embedding_dimension?: number;
}

/**
 * Filter options for ACL-aware queries
 */
export interface AclFilterOptions {
  userId?: string;
  teamSlug?: string;
  permission?: 'read' | 'write' | 'admin';
  requirePublic?: boolean;
}

/**
 * Build Qdrant filter from ACL options
 */
export function buildAclFilter(options: AclFilterOptions): Record<string, unknown> {
  const must: Array<Record<string, unknown>> = [];

  // If public documents are allowed
  if (options.requirePublic !== false) {
    must.push({
      key: 'acl.public',
      match: { value: true }
    });
  }

  // User-specific filters
  if (options.userId) {
    must.push({
      key: 'acl.read_users',
      match: { value: options.userId }
    });
  }

  // Team-specific filters
  if (options.teamSlug) {
    must.push({
      key: 'acl.read_teams',
      match: { value: options.teamSlug }
    });
  }

  return { must };
}

/**
 * Merge source metadata into Qdrant payload
 */
export function mergeSourceMetadata(
  basePayload: BaseQdrantPayload,
  sourceType: SourceMetadata['source_type'],
  sourceMetadata: Partial<SourceMetadata>,
  acl?: AclInfo
): EnhancedQdrantPayload {
  return {
    ...basePayload,
    source: {
      source_type: sourceType,
      ...sourceMetadata
    },
    acl,
    external_document_id: sourceMetadata.external_document_id,
    external_url: sourceMetadata.external_url
  };
}

/**
 * Extract ACL information from external document
 */
export function extractAclFromExternalDocument(
  permissions?: Array<{
    principalId: string;
    permissionLevel: 'read' | 'write' | 'admin' | 'owner';
  }>,
  mappedAcls?: Array<{
    internal_user_id?: string;
    internal_team_slug?: string;
    permission_level: 'read' | 'write' | 'admin';
  }>
): AclInfo {
  const acl: AclInfo = {
    source_permissions: permissions?.map(p => ({
      principal_id: p.principalId,
      principal_type: 'user' as const,
      permission_level: p.permissionLevel
    })),
    mapped_acls: mappedAcls?.map(a => ({
      internal_user_id: a.internal_user_id,
      internal_team_slug: a.internal_team_slug,
      permission_level: a.permission_level
    }))
  };

  // Build read/write/admin arrays from mapped ACLs
  const readUsers: string[] = [];
  const readTeams: string[] = [];
  const writeUsers: string[] = [];
  const writeTeams: string[] = [];
  const adminUsers: string[] = [];
  const adminTeams: string[] = [];

  for (const mapped of mappedAcls || []) {
    if (mapped.internal_user_id) {
      if (mapped.permission_level === 'read') readUsers.push(mapped.internal_user_id);
      if (mapped.permission_level === 'write') writeUsers.push(mapped.internal_user_id);
      if (mapped.permission_level === 'admin') adminUsers.push(mapped.internal_user_id);
    }
    if (mapped.internal_team_slug) {
      if (mapped.permission_level === 'read') readTeams.push(mapped.internal_team_slug);
      if (mapped.permission_level === 'write') writeTeams.push(mapped.internal_team_slug);
      if (mapped.permission_level === 'admin') adminTeams.push(mapped.internal_team_slug);
    }
  }

  acl.read_users = readUsers;
  acl.read_teams = readTeams;
  acl.write_users = writeUsers;
  acl.write_teams = writeTeams;
  acl.admin_users = adminUsers;
  acl.admin_teams = adminTeams;

  // Check if document is public (no ACLs means public by default)
  acl.public = !permissions || permissions.length === 0;

  return acl;
}

/**
 * Convert EnhancedQdrantPayload to plain Qdrant payload
 * Qdrant stores payloads as JSON, so we flatten the structure
 */
export function flattenEnhancedPayload(
  enhanced: EnhancedQdrantPayload
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {
    ...enhanced
  };

  // Flatten source metadata
  if (enhanced.source) {
    flattened.source_type = enhanced.source.source_type;
    flattened.external_document_id = enhanced.source.external_document_id;
    flattened.external_url = enhanced.source.external_url;
    flattened.external_updated_at = enhanced.source.external_updated_at;
    flattened.author_name = enhanced.source.author_name;
    flattened.author_email = enhanced.source.author_email;
    flattened.author_id = enhanced.source.author_id;
    flattened.content_type = enhanced.source.content_type;
    flattened.language = enhanced.source.language;
    flattened.word_count = enhanced.source.word_count;
    flattened.char_count = enhanced.source.char_count;

    // Add source-specific fields with prefix
    if (enhanced.source.confluence) {
      Object.entries(enhanced.source.confluence).forEach(([key, value]) => {
        flattened[`confluence_${key}`] = value;
      });
    }
    if (enhanced.source.notion) {
      Object.entries(enhanced.source.notion).forEach(([key, value]) => {
        flattened[`notion_${key}`] = value;
      });
    }
    if (enhanced.source.sharepoint) {
      Object.entries(enhanced.source.sharepoint).forEach(([key, value]) => {
        flattened[`sharepoint_${key}`] = value;
      });
    }
    if (enhanced.source.google_drive) {
      Object.entries(enhanced.source.google_drive).forEach(([key, value]) => {
        flattened[`gdrive_${key}`] = value;
      });
    }
    if (enhanced.source.slack) {
      Object.entries(enhanced.source.slack).forEach(([key, value]) => {
        flattened[`slack_${key}`] = value;
      });
    }
    if (enhanced.source.web) {
      Object.entries(enhanced.source.web).forEach(([key, value]) => {
        flattened[`web_${key}`] = value;
      });
    }
    if (enhanced.source.database) {
      Object.entries(enhanced.source.database).forEach(([key, value]) => {
        flattened[`database_${key}`] = value;
      });
    }
  }

  // Flatten ACL
  if (enhanced.acl) {
    flattened.acl_public = enhanced.acl.public;
    flattened.acl_read_users = JSON.stringify(enhanced.acl.read_users || []);
    flattened.acl_read_teams = JSON.stringify(enhanced.acl.read_teams || []);
    flattened.acl_write_users = JSON.stringify(enhanced.acl.write_users || []);
    flattened.acl_write_teams = JSON.stringify(enhanced.acl.write_teams || []);
    flattened.acl_admin_users = JSON.stringify(enhanced.acl.admin_users || []);
    flattened.acl_admin_teams = JSON.stringify(enhanced.acl.admin_teams || []);
  }

  return flattened;
}

/**
 * Validate that user has access to document based on ACL
 */
export function validateAclAccess(
  payload: EnhancedQdrantPayload,
  userId?: string,
  teamSlugs?: string[],
  requiredPermission: 'read' | 'write' | 'admin' = 'read'
): boolean {
  const acl = payload.acl;

  // If no ACL or public, everyone has access
  if (!acl || acl.public === true) {
    return true;
  }

  // Check user permissions
  if (userId) {
    const readUsers = acl.read_users || [];
    const writeUsers = acl.write_users || [];
    const adminUsers = acl.admin_users || [];

    if (requiredPermission === 'read' && readUsers.includes(userId)) {
      return true;
    }
    if (requiredPermission === 'write' && writeUsers.includes(userId)) {
      return true;
    }
    if (requiredPermission === 'admin' && adminUsers.includes(userId)) {
      return true;
    }
  }

  // Check team permissions
  if (teamSlugs && teamSlugs.length > 0) {
    const readTeams = acl.read_teams || [];
    const writeTeams = acl.write_teams || [];
    const adminTeams = acl.admin_teams || [];

    const hasTeamRead = teamSlugs.some(t => readTeams.includes(t));
    const hasTeamWrite = teamSlugs.some(t => writeTeams.includes(t));
    const hasTeamAdmin = teamSlugs.some(t => adminTeams.includes(t));

    if (requiredPermission === 'read' && hasTeamRead) {
      return true;
    }
    if (requiredPermission === 'write' && hasTeamWrite) {
      return true;
    }
    if (requiredPermission === 'admin' && hasTeamAdmin) {
      return true;
    }
  }

  return false;
}

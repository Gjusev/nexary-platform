/**
 * SCIM 2.0 Service
 * Handles provisioning operations with Stack Auth
 */

import { query } from '@/lib/db';
import type {
  SCIMUser,
  SCIMGroup,
  SCIMListResponse,
  SCIMPatchOperation,
  SCIMServiceProviderConfig,
  SCIMResourceType,
} from './scim-types';
import {
  SCIM_SCHEMAS,
  getSCIMLocation,
  createSCIMMeta,
} from './scim-types';

/**
 * SCIM Service for provisioning operations
 */
export class SCIMService {
  private teamSlug: string;

  constructor(teamSlug: string) {
    this.teamSlug = teamSlug;
  }

  /**
   * List users with optional filtering
   * @param filter SCIM filter expression (e.g., 'userName eq "john.doe@example.com"')
   * @param startIndex Starting index for pagination
   * @param count Number of results to return
   * @returns SCIM list response with users
   */
  async listUsers(
    filter?: string,
    startIndex: number = 1,
    count: number = 100
  ): Promise<SCIMListResponse<SCIMUser>> {
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    // Build query parameters
    const params: any = {
      limit: Math.min(count, 100), // Max 100 per request
    };

    // Parse and apply filter
    if (filter) {
      const parsedFilter = this.parseFilter(filter);
      if (parsedFilter.attributeName === 'userName' || parsedFilter.attributeName === 'email') {
        params.query = parsedFilter.value;
      }
    }

    // Get users from Stack Auth
    const users = await stackServerApp.listUsers(params);

    // Convert to SCIM format
    const resources: SCIMUser[] = users.map((user) => this.toSCIMUser(user, this.teamSlug));

    // Apply pagination
    const paginatedResources = resources.slice(startIndex - 1, startIndex - 1 + count);

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex,
      itemsPerPage: paginatedResources.length,
      Resources: paginatedResources,
    };
  }

  /**
   * Get a user by ID
   * @param id User ID (Stack Auth user ID or userName)
   * @returns SCIM user or null if not found
   */
  async getUser(id: string): Promise<SCIMUser | null> {
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    // Try to get user by ID (Stack Auth user ID)
    const user = await stackServerApp.getUser(id);

    if (user) {
      return this.toSCIMUser(user, this.teamSlug);
    }

    // If not found by ID, try to find by userName (email)
    const users = await stackServerApp.listUsers({
      query: id,
      limit: 2,
    });

    const foundUser = users.find((u) => u.primaryEmail === id || u.id === id);

    if (foundUser) {
      return this.toSCIMUser(foundUser, this.teamSlug);
    }

    return null;
  }

  /**
   * Create a new user
   * @param user SCIM user to create
   * @returns Created SCIM user
   */
  async createUser(user: SCIMUser): Promise<SCIMUser> {
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    // Generate a random password (SCIM users authenticate via SAML)
    const password = this.generateRandomPassword();

    // Create user in Stack Auth
    const newUser = await stackServerApp.createUser({
      primaryEmail: user.userName,
      password,
      displayName: user.displayName || user.name?.formatted || `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim(),
      primaryEmailVerified: true,
      primaryEmailAuthEnabled: false, // SCIM users use SAML
      clientMetadata: {
        scimExternalId: user.externalId,
        scimProvisioned: true,
      },
    });

    // Add user to team
    await this.addUserToTeam(newUser.id, user.userName, user.displayName);

    return this.toSCIMUser(newUser, this.teamSlug, user.externalId);
  }

  /**
   * Update an existing user
   * @param id User ID
   * @param user SCIM user with updates
   * @returns Updated SCIM user
   */
  async updateUser(id: string, user: Partial<SCIMUser>): Promise<SCIMUser> {
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    const stackUser = await stackServerApp.getUser(id);

    if (!stackUser) {
      throw new Error(`User not found: ${id}`);
    }

    // Update user in Stack Auth
    if (user.displayName || user.name) {
      const displayName = user.displayName || user.name?.formatted || `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim();
      await stackUser.update({
        displayName,
      });
    }

    // Update email if changed
    if (user.userName && user.userName !== stackUser.primaryEmail) {
      await stackUser.update({
        primaryEmail: user.userName,
      });
    }

    // Update active status (deactivate if active=false)
    if (user.active === false) {
      // Stack Auth doesn't have built-in deactivation, so we'd need to implement this
      // For now, we'll set a flag in clientMetadata
      await stackUser.update({
        clientMetadata: {
          ...stackUser.clientMetadata,
          scimActive: false,
        },
      });
    } else if (user.active === true) {
      await stackUser.update({
        clientMetadata: {
          ...stackUser.clientMetadata,
          scimActive: true,
        },
      });
    }

    // Get updated user
    const updatedUser = await stackServerApp.getUser(id);

    return this.toSCIMUser(updatedUser!, this.teamSlug, user.externalId);
  }

  /**
   * Patch a user (partial update)
   * @param id User ID
   * @param operations Array of patch operations
   * @returns Updated SCIM user
   */
  async patchUser(id: string, operations: SCIMPatchOperation[]): Promise<SCIMUser> {
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    const stackUser = await stackServerApp.getUser(id);

    if (!stackUser) {
      throw new Error(`User not found: ${id}`);
    }

    const updates: any = {};

    for (const op of operations) {
      const path = op.path?.replace(/^\/+/, ''); // Remove leading slashes

      switch (op.op) {
        case 'replace':
          if (path === 'displayName' || path === 'name.formatted') {
            updates.displayName = op.value;
          } else if (path === 'userName') {
            updates.primaryEmail = op.value;
          } else if (path === 'active') {
            updates.clientMetadata = {
              ...stackUser.clientMetadata,
              scimActive: op.value,
            };
          }
          break;

        case 'add':
          if (path === 'emails') {
            if (Array.isArray(op.value) && op.value[0]?.value) {
              updates.primaryEmail = op.value[0].value;
            }
          }
          break;

        case 'remove':
          // Handle removal of attributes
          break;
      }
    }

    if (Object.keys(updates).length > 0) {
      await stackUser.update(updates);
    }

    const updatedUser = await stackServerApp.getUser(id);

    return this.toSCIMUser(updatedUser!, this.teamSlug);
  }

  /**
   * Delete (deactivate) a user
   * @param id User ID
   */
  async deleteUser(id: string): Promise<void> {
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    const stackUser = await stackServerApp.getUser(id);

    if (!stackUser) {
      throw new Error(`User not found: ${id}`);
    }

    // Remove user from team (soft delete)
    await query(
      `UPDATE team_members
       SET status = 'removed', removed_at = NOW()
       WHERE user_id = $1 AND team_slug = $2`,
      [id, this.teamSlug]
    );

    // Mark user as inactive in SCIM metadata
    await stackUser.update({
      clientMetadata: {
        ...stackUser.clientMetadata,
        scimActive: false,
        scimDeletedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * List groups
   * @param filter SCIM filter expression
   * @param startIndex Starting index
   * @param count Number of results
   * @returns SCIM list response with groups
   */
  async listGroups(
    filter?: string,
    startIndex: number = 1,
    count: number = 100
  ): Promise<SCIMListResponse<SCIMGroup>> {
    // For now, groups correspond to teams in the system
    const result = await query(
      `SELECT slug, display_name, created_at
       FROM teams
       WHERE slug = $1 OR slug IN (
         SELECT team_slug FROM team_members WHERE user_id IN (
           SELECT user_id FROM team_members WHERE team_slug = $1
         )
       )
       ORDER BY display_name
       LIMIT $2 OFFSET $3`,
      [this.teamSlug, count, startIndex - 1]
    );

    const resources: SCIMGroup[] = result.rows.map((row) => ({
      schemas: [SCIM_SCHEMAS.GROUP],
      id: row.slug,
      displayName: row.display_name || row.slug,
      meta: createSCIMMeta('Group', row.slug, new Date(row.created_at)),
    }));

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM teams`
    );

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: parseInt(countResult.rows[0].total),
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  /**
   * Get a group by ID
   * @param id Group ID (team slug)
   * @returns SCIM group or null
   */
  async getGroup(id: string): Promise<SCIMGroup | null> {
    const result = await query(
      `SELECT slug, display_name, created_at
       FROM teams
       WHERE slug = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      schemas: [SCIM_SCHEMAS.GROUP],
      id: row.slug,
      displayName: row.display_name || row.slug,
      meta: createSCIMMeta('Group', row.slug, new Date(row.created_at)),
    };
  }

  /**
   * Get Service Provider Config
   * @returns SCIM Service Provider Configuration
   */
  getServiceProviderConfig(): SCIMServiceProviderConfig {
    return {
      schemas: [SCIM_SCHEMAS.SERVICE_PROVIDER_CONFIG],
      patch: {
        supported: true,
      },
      bulk: {
        supported: false,
        maxOperations: 0,
        maxPayloadSize: 0,
      },
      filter: {
        supported: true,
        maxResults: 100,
      },
      changePassword: {
        supported: false,
      },
      sort: {
        supported: false,
      },
      etag: {
        supported: false,
      },
      authenticationSchemes: [
        {
          name: 'OAuth Bearer Token',
          description: 'Authentication using Bearer token',
          type: 'oauthbearertoken',
          primary: true,
        },
      ],
      meta: {
        location: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scim/v2/ServiceProviderConfig`,
        resourceType: 'ServiceProviderConfig',
      },
    };
  }

  /**
   * Convert Stack Auth user to SCIM user format
   */
  private toSCIMUser(
    user: any,
    teamSlug: string,
    externalId?: string
  ): SCIMUser {
    const displayName = user.displayName || '';
    const names = displayName.split(' ');
    const givenName = names[0] || '';
    const familyName = names.slice(1).join(' ') || '';

    return {
      schemas: [SCIM_SCHEMAS.USER],
      id: user.id,
      externalId: externalId || (user.clientMetadata?.scimExternalId as string | undefined),
      userName: user.primaryEmail || user.email || '',
      name: {
        givenName,
        familyName,
        formatted: displayName,
      },
      displayName: displayName,
      active: user.clientMetadata?.scimActive !== false,
      emails: [
        {
          value: user.primaryEmail || user.email || '',
          type: 'work',
          primary: true,
        },
      ],
      meta: createSCIMMeta('User', user.id, new Date(user.signedUpAt)),
    };
  }

  /**
   * Add user to team
   */
  private async addUserToTeam(
    userId: string,
    email: string,
    displayName?: string
  ): Promise<void> {
    // Check if team exists
    const teamResult = await query(
      `SELECT id FROM teams WHERE slug = $1`,
      [this.teamSlug]
    );

    if (teamResult.rows.length === 0) {
      throw new Error(`Team not found: ${this.teamSlug}`);
    }

    const teamId = teamResult.rows[0].id;

    // Check if user is already a member
    const memberResult = await query(
      `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (memberResult.rows.length === 0) {
      // Add user as team member
      await query(
        `INSERT INTO team_members (team_id, user_id, email, display_name, role, status)
         VALUES ($1, $2, $3, $4, 'member', 'active')`,
        [teamId, userId, email, displayName || null]
      );
    } else {
      // Update existing member
      await query(
        `UPDATE team_members
         SET status = 'active', last_active = NOW()
         WHERE id = $1`,
        [memberResult.rows[0].id]
      );
    }
  }

  /**
   * Parse SCIM filter expression
   * Supports basic operators: eq, co, sw, ew
   */
  private parseFilter(filter: string): {
    attributeName: string;
    operator: string;
    value: string;
  } {
    // Simple parser for basic filters: "attributeName operator value"
    // e.g., "userName eq 'john.doe@example.com'"
    const eqMatch = filter.match(/(\w+)\s+eq\s+["'](.+?)["']/i);
    if (eqMatch) {
      return {
        attributeName: eqMatch[1],
        operator: 'eq',
        value: eqMatch[2],
      };
    }

    const coMatch = filter.match(/(\w+)\s+co\s+["'](.+?)["']/i);
    if (coMatch) {
      return {
        attributeName: coMatch[1],
        operator: 'co',
        value: coMatch[2],
      };
    }

    // Default: return filter as-is for complex parsing
    return {
      attributeName: 'userName',
      operator: 'eq',
      value: filter,
    };
  }

  /**
   * Generate a random password for SCIM-provisioned users
   */
  private generateRandomPassword(length: number = 32): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }

    return password;
  }
}

/**
 * Stack Auth Adapter
 *
 * This module provides integration between OIDC/SAML authentication and Stack Auth.
 * It handles creating or linking users in Stack Auth based on external identity provider data.
 *
 * NOTE: This is a placeholder implementation. The actual Stack Auth integration
 * will depend on your Stack Auth configuration and SDK.
 */

import type { OIDCUserProfile } from '@/lib/oidc/oidc-types';

// ============================================================================
// STACK AUTH USER TYPES
// ============================================================================

export interface StackAuthUser {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  primaryEmail: string;
  displayNameRaw?: string | null;
}

export interface StackAuthSession {
  user: StackAuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

// ============================================================================
// STACK AUTH INTEGRATION
// ============================================================================

/**
 * Get or create user in Stack Auth from OIDC profile
 *
 * This function searches for an existing user by email, and if not found,
 * creates a new user in Stack Auth. It returns the user object that can be
 * used to create a session.
 *
 * @param teamSlug - The team slug for context
 * @param profile - OIDC user profile
 * @returns Stack Auth user object
 */
export async function getOrCreateStackAuthUser(
  teamSlug: string,
  profile: OIDCUserProfile
): Promise<StackAuthUser> {
  // TODO: Implement actual Stack Auth integration
  // This is a placeholder that demonstrates the expected flow

  try {
    // Step 1: Try to find existing user by email
    const existingUser = await findStackAuthUserByEmail(profile.email);

    if (existingUser) {
      // User exists, ensure they're a member of the team
      await ensureTeamMembership(existingUser.id, teamSlug);
      return existingUser;
    }

    // Step 2: Create new user in Stack Auth
    const newUser = await createStackAuthUser({
      email: profile.email,
      primaryEmail: profile.email,
      displayName: profile.displayName || profile.email,
      displayNameRaw: profile.displayName || null,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });

    // Step 3: Add user to team
    await ensureTeamMembership(newUser.id, teamSlug);

    return newUser;
  } catch (error) {
    console.error('Stack Auth adapter error:', error);
    throw new Error('Failed to get or create Stack Auth user');
  }
}

/**
 * Create a session in Stack Auth for a user
 *
 * This creates an authenticated session that can be used by the application.
 *
 * @param userId - Stack Auth user ID
 * @returns Session object with access token
 */
export async function createStackAuthSession(
  userId: string
): Promise<StackAuthSession> {
  // TODO: Implement actual Stack Auth session creation
  // This is a placeholder

  return {
    user: {
      id: userId,
      email: '',
      primaryEmail: '',
    },
    accessToken: crypto.randomUUID(), // Placeholder
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
}

/**
 * Set session cookie for the response
 *
 * This sets an HTTP-only cookie containing the session token.
 *
 * @param session - Stack Auth session
 * @returns Cookie header value
 */
export function getSessionCookieValue(session: StackAuthSession): string {
  // TODO: Implement actual session cookie creation
  // This should create a signed, HTTP-only cookie

  const cookieValue = JSON.stringify({
    userId: session.user.id,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt?.toISOString(),
  });

  return Buffer.from(cookieValue).toString('base64');
}

// ============================================================================
// HELPER FUNCTIONS (PLACEHOLDER)
// ============================================================================

/**
 * Find existing Stack Auth user by email
 */
async function findStackAuthUserByEmail(
  email: string
): Promise<StackAuthUser | null> {
  // TODO: Implement actual Stack Auth user lookup
  // For now, return null (user doesn't exist)

  // Placeholder implementation:
  // - Query Stack Auth API for user by email
  // - Return user object if found
  // - Return null if not found

  return null;
}

/**
 * Create new user in Stack Auth
 */
async function createStackAuthUser(
  userData: {
    email: string;
    primaryEmail: string;
    displayName?: string;
    displayNameRaw?: string | null;
    firstName?: string;
    lastName?: string;
  }
): Promise<StackAuthUser> {
  // TODO: Implement actual Stack Auth user creation
  // For now, return a placeholder user

  // Placeholder implementation:
  // - Call Stack Auth API to create user
  // - Return created user object

  return {
    id: crypto.randomUUID(),
    ...userData,
  };
}

/**
 * Ensure user is a member of the team
 */
async function ensureTeamMembership(
  userId: string,
  teamSlug: string
): Promise<void> {
  // TODO: Implement actual team membership check/addition
  // Placeholder implementation:
  // - Check if user is already a member
  // - If not, add them as a member
  // - Use appropriate role (member by default)

  const { query } = await import('@/lib/db');

  // Check if user is already a member
  const existingMember = await query(
    `SELECT id FROM projectnexus.team_members
     WHERE user_id = $1
       AND team_id = (SELECT id FROM projectnexus.teams WHERE slug = $2)`,
    [userId, teamSlug]
  );

  if (existingMember.rows.length === 0) {
    // Get team ID
    const teamResult = await query(
      `SELECT id FROM projectnexus.teams WHERE slug = $1`,
      [teamSlug]
    );

    if (teamResult.rows.length > 0) {
      const teamId = teamResult.rows[0].id;

      // Add user as team member
      await query(
        `INSERT INTO projectnexus.team_members (
          team_id,
          user_id,
          email,
          role,
          status
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          teamId,
          userId,
          '', // Email will be updated from user profile
          'member',
          'active',
        ]
      );
    }
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get current user from session cookie
 *
 * This validates the session cookie and returns the user if valid.
 *
 * @param cookieValue - Value from the session cookie
 * @returns Stack Auth user or null
 */
export function getUserFromSessionCookie(
  cookieValue: string
): StackAuthUser | null {
  // TODO: Implement actual session validation
  // This should:
  // - Decode and verify the cookie signature
  // - Check if session is still valid (not expired)
  // - Return user object if valid
  // - Return null if invalid or expired

  try {
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
    const session = JSON.parse(decoded) as StackAuthSession;

    // Check expiration
    if (session.expiresAt && session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

/**
 * Clear session cookie
 *
 * @returns Cookie header value to clear the cookie
 */
export function getClearSessionCookieValue(): string {
  // TODO: Implement actual session clearing
  // This should return a cookie header that expires the cookie

  return ''; // Placeholder
}

// ============================================================================
// CRYPTO IMPORT (for placeholder)
// ============================================================================

// Node.js crypto module for placeholder implementation
import * as crypto from 'crypto';

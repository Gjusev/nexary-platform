import type { NextRequest } from 'next/server';

/**
 * Get the current authenticated user from Stack Auth
 * This is a server-side function to be used in API routes
 */
export async function getStackUser(request?: NextRequest) {
  try {
    // Use existing Stack Server App singleton
    const { stackServerApp } = await import('./stack-server');

    // If request is provided, use it for token store
    const options = request ? { tokenStore: request } : {};

    const user = await stackServerApp.getUser(options);
    return user;
  } catch (error) {
    console.error('Error getting Stack Auth user:', error);
    return null;
  }
}

/**
 * Get user by ID from Stack Auth
 */
export async function getStackUserById(userId: string) {
  try {
    // Use existing Stack Server App singleton
    const { stackServerApp } = await import('./stack-server');
    const user = await stackServerApp.getUser(userId);
    return user;
  } catch (error) {
    console.error('Error getting Stack Auth user by ID:', error);
    return null;
  }
}


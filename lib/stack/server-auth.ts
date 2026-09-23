import { stackServerApp } from '@/lib/stack/stack-server';

/**
 * Get the current authenticated user from Stack Auth in server components/API routes
 * This replaces getServerSession from NextAuth
 */
export async function getStackServerUser() {
  try {
    const user = await stackServerApp.getUser({ or: 'return-null' });
    
    if (!user) {
      return null;
    }

    // Get user's teams
    const teams = await user.listTeams();
    const primaryTeam = teams.length > 0 ? teams[0] : null;

    return {
      user: {
        id: user.id,
        email: user.primaryEmail,
        name: user.displayName,
      },
      team: primaryTeam ? {
        id: primaryTeam.id,
        name: primaryTeam.displayName,
        slug: (primaryTeam as any).serverMetadata?.slug || null,
      } : null,
    };
  } catch (error) {
    console.error('Error getting Stack Auth user:', error);
    return null;
  }
}

/**
 * Require authentication - throws if user is not logged in
 */
export async function requireStackAuth() {
  const session = await getStackServerUser();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Type for the session returned by Stack Auth
 * This replaces the NextAuth Session type
 */
export type StackSession = Awaited<ReturnType<typeof getStackServerUser>>;

import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions } from 'next-auth';

import { authenticateWithStackAuth, fetchStackProfile } from '@/lib/stack/client';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';

const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (!nextAuthSecret) {
  throw new Error('NEXTAUTH_SECRET must be set for NextAuth.');
}

declare module 'next-auth' {
  interface Session {
    teamSlug?: string | null;
    roles?: string[];
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }

  interface User {
    id: string;
    email?: string | null;
    teamSlug?: string | null;
    roles?: string[];
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    teamSlug?: string | null;
    roles?: string[];
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes - session timeout
    updateAge: 5 * 60, // Update session every 5 minutes of activity
  },
  jwt: {
    maxAge: 30 * 60, // 30 minutes - JWT expiration
  },
  providers: [
    CredentialsProvider({
      id: 'stack-auth',
      name: 'Stack Auth',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        const authResponse = await authenticateWithStackAuth({
          email: credentials.email,
          password: credentials.password,
        });

        if (!authResponse) {
          return null;
        }

        const profile = await fetchStackProfile(authResponse.userId);

        return {
          id: profile.user.id,
          email: profile.user.email ?? authResponse.email ?? undefined,
          teamSlug: profile.team?.slug ?? null,
          roles: profile.roles ?? [],
        };

        // Log successful login (fire and forget)
        logAudit({
          action: 'LOGIN',
          userId: profile.user.id,
          teamSlug: profile.team?.slug ?? undefined,
          targetType: 'user',
          targetId: profile.user.id,
          metadata: { email: profile.user.email }
        }).catch(err => console.error('Audit log failed', err));
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.teamSlug = user.teamSlug ?? null;
        token.roles = user.roles ?? [];
        token.accessToken = undefined;
        token.refreshToken = undefined;
        token.expiresAt = undefined;
      }

      if (trigger === 'update' && session) {
        if ('teamSlug' in session) token.teamSlug = session.teamSlug as string | null;
        if ('roles' in session) token.roles = session.roles as string[];
      }

      // Merge global roles from DB (role_assignments)
      try {
        if (token.sub) {
          const { rows } = await query<{ role: string }>(
            `SELECT role FROM role_assignments WHERE user_id = $1`,
            [token.sub as string]
          );
          const fromDb = rows.map((r) => r.role);
          const existing = (token.roles as string[]) || [];
          token.roles = Array.from(new Set([...existing, ...fromDb]));
        }
      } catch (e) {
        // swallow DB errors to not break auth
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? '',
        },
        teamSlug: token.teamSlug ?? null,
        roles: (token.roles as string[]) ?? [],
        accessToken: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
      };
    },
  },
  pages: {
    signIn: '/login',
  },
};

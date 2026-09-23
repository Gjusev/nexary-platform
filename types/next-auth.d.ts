import 'next-auth';

declare module 'next-auth' {
  interface Session {
    teamSlug?: string | null;
    roles?: string[];
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }

  interface User {
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

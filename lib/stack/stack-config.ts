// Get configuration from environment variables
const baseUrl =
  process.env.NEXT_PUBLIC_STACK_API_URL ||
  process.env.STACK_AUTH_API_URL ||
  process.env.STACK_INTERNAL_API_URL ||
  'https://sa-api.mokka-dev.de';

// Ensure all Stack Auth consumers see the resolved base URL even if only server-side env vars are present
if (!process.env.NEXT_PUBLIC_STACK_API_URL) {
  process.env.NEXT_PUBLIC_STACK_API_URL = baseUrl;
}

const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID || '';
const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || '';

// Validate required configuration
if (!projectId || !publishableClientKey) {
  console.error('Missing Stack Auth configuration:', {
    projectId: !!projectId,
    publishableClientKey: !!publishableClientKey,
    baseUrl,
  });
  throw new Error('Stack Auth configuration is incomplete');
}

// Exact configuration object for client-side
export const clientAppConfig = {
  tokenStore: 'nextjs-cookie' as const,
  projectId,
  publishableClientKey,
  baseUrl,
  urls: {
    signIn: '/login',
    signUp: '/register',
    afterSignIn: '/chat',
    afterSignUp: '/chat',
  },
};

// Exact configuration object for server-side
export const serverAppConfig = {
  tokenStore: 'nextjs-cookie' as const,
  projectId,
  publishableClientKey,
  secretServerKey: process.env.STACK_SECRET_SERVER_KEY || '',
  baseUrl,
};

console.debug('[Stack Config] Server config initialized:', {
  projectId: projectId.substring(0, 8) + '...',
  baseUrl,
});

import { StackServerApp } from '@stackframe/stack';
import { serverAppConfig } from './stack-config';

// Use unified configuration
//// Singleton instance for server-side use (with cookie support for API routes)
export const stackServerApp = new StackServerApp({
  ...serverAppConfig,
  tokenStore: 'nextjs-cookie' as const,
});

// Singleton instance for middleware use (with cookie support)
export const stackServerAppForMiddleware = new StackServerApp({
  ...serverAppConfig,
  tokenStore: 'nextjs-cookie' as const,
});

export type StackTokenStore = 'memory' | 'nextjs-cookie' | { accessToken: string; refreshToken: string };

// Legacy function for backward compatibility
export function createStackServerApp(tokenStore: StackTokenStore = 'memory') {
  // Type assertion is needed here as Stack SDK accepts various token store formats
  return new StackServerApp({
    ...serverAppConfig,
    tokenStore: tokenStore as 'memory' | 'nextjs-cookie' | { accessToken: string; refreshToken: string },
  });
}

'use client';

import { StackProvider } from '@stackframe/stack';
import { StackClientApp } from '@stackframe/stack';
import { clientAppConfig } from '@/lib/stack/stack-config';
import { useEffect, useState } from 'react';

interface StackAuthProviderProps {
  children: React.ReactNode;
}

// Create a new StackClientApp instance with unified configuration
export function StackAuthProvider({ children }: StackAuthProviderProps) {
  const [app, setApp] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Clear any existing cached configuration
      // Clear any existing cached configuration
      // We removed the aggressive localStorage clearing here as it was causing infinite loops
      // The StackClientApp handles its own state management

      const newApp = new StackClientApp(clientAppConfig);
      setApp(newApp);
      setError(null);
      } catch (err) {
      console.error('❌ [Stack Provider] Error creating StackClientApp:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Don't try to create a fallback app - this causes configuration conflicts
      console.warn('⚠️ [Stack Provider] Running without Stack Auth due to initialization error');
    }
  }, []);

  if (error) {
    console.warn('⚠️ [Stack Provider] Stack Auth initialization failed, continuing without auth:', error);
    // Return children without StackProvider as fallback
    return <>{children}</>;
  }

  if (!app) {
    // Show loading state while initializing
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading authentication...</div>
      </div>
    );
  }

  return (
    <StackProvider app={app}>
      {children}
    </StackProvider>
  );
}

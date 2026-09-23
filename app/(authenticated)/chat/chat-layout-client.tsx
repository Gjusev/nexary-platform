'use client';

import { Component, ReactNode } from 'react';
import ChatLayout from './chat-layout';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children?: ReactNode;
  translations?: any;
}

class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[Chat Error Boundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[Chat Error Boundary] Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <div className="max-w-md w-full p-6 bg-card border border-border rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The chat interface encountered an error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm font-mono bg-muted p-2 rounded">
                  Error details
                </summary>
                <pre className="mt-2 text-xs bg-background p-2 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ChatLayoutClient({ translations }: { translations?: any }) {
  return (
    <ChatErrorBoundary>
      <ChatLayout />
    </ChatErrorBoundary>
  );
}

'use client';

/**
 * ChatProviders Component
 *
 * Combined provider component that includes all chat-related providers.
 * This makes it easy to wrap the entire chat layout with all necessary contexts.
 *
 * @example
 * ```tsx
 * <ChatProviders initialMessages={messages}>
 *   <ChatLayout />
 * </ChatProviders>
 * ```
 */

import { ReactNode } from 'react';
import {
  ChatMessagesProvider,
  ChatStreamingProvider,
  ChatNavigationProvider,
} from './index';
import type { ChatMessage } from '@/hooks/chat';

export interface ChatProvidersProps {
  children: ReactNode;
  initialMessages?: ChatMessage[];
}

/**
 * Combined provider for all chat-related functionality
 *
 * Wraps children with all necessary providers in the correct order:
 * 1. Navigation (outermost)
 * 2. Streaming
 * 3. Messages (innermost)
 */
export function ChatProviders({ children, initialMessages }: ChatProvidersProps) {
  return (
    <ChatNavigationProvider>
      <ChatStreamingProvider>
        <ChatMessagesProvider initialMessages={initialMessages}>
          {children}
        </ChatMessagesProvider>
      </ChatStreamingProvider>
    </ChatNavigationProvider>
  );
}

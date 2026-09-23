'use client';

/**
 * ChatNavigationProvider Component
 *
 * Provider component that wraps useChatNavigation hook and exposes
 * navigation functionality through React context.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useChatNavigation, type Conversation, type CreateConversationOptions } from '@/hooks/chat';

interface ChatNavigationContextValue {
  isCreatingConversation: boolean;
  isTransitioning: boolean;
  transitionDirection: 'enter' | 'exit';

  createOptimisticConversation: (
    options: CreateConversationOptions,
    onOptimisticUpdate: (conversation: Conversation) => void,
    onError: (error: Error, restoredMessage: string) => void
  ) => Promise<Conversation | null>;
}

const ChatNavigationContext = createContext<ChatNavigationContextValue | undefined>(undefined);

export interface ChatNavigationProviderProps {
  children: ReactNode;
}

/**
 * Provider component for chat navigation management
 *
 * @example
 * ```tsx
 * <ChatNavigationProvider>
 *   <YourChatComponent />
 * </ChatNavigationProvider>
 * ```
 */
export function ChatNavigationProvider({ children }: ChatNavigationProviderProps) {
  const navigationHook = useChatNavigation();

  return (
    <ChatNavigationContext.Provider value={navigationHook}>
      {children}
    </ChatNavigationContext.Provider>
  );
}

/**
 * Hook to access chat navigation context
 *
 * @throws Error if used outside ChatNavigationProvider
 */
export function useChatNavigationContext(): ChatNavigationContextValue {
  const context = useContext(ChatNavigationContext);
  if (!context) {
    throw new Error('useChatNavigationContext must be used within ChatNavigationProvider');
  }
  return context;
}

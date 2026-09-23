'use client';

/**
 * ChatMessagesProvider Component
 *
 * Provider component that wraps useChatMessages hook and exposes
 * message management functionality through React context.
 *
 * This allows chat-layout.tsx to use the message management hooks
 * without directly calling them, making the integration gradual.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useChatMessages, type ChatMessage } from '@/hooks/chat';

interface ChatMessagesContextValue {
  messages: ChatMessage[];
  messageSources: Record<string, any[]>;
  webSearchSources: Record<string, any[]>;
  messageReasoning: Record<string, string>;
  messageModelInfo: Record<string, { provider: string; model: string; modelName: string }>;
  pinnedMessages: Set<string>;
  messageFeedback: Record<string, 'up' | 'down'>;

  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageMetadata: (id: string, metadata: any) => void;

  pinMessage: (id: string) => void;
  setMessageFeedback: (id: string, type: 'up' | 'down') => void;

  setMessageSources: (messageId: string, sources: any[]) => void;
  setWebSearchSources: (messageId: string, sources: any[]) => void;
  setMessageReasoning: (messageId: string, reasoning: string) => void;
  setMessageModelInfo: (messageId: string, info: { provider: string; model: string; modelName: string }) => void;

  transferMessageData: (fromId: string, toId: string) => void;
  replaceMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

const ChatMessagesContext = createContext<ChatMessagesContextValue | undefined>(undefined);

export interface ChatMessagesProviderProps {
  children: ReactNode;
  initialMessages?: ChatMessage[];
}

/**
 * Provider component for chat message management
 *
 * @example
 * ```tsx
 * <ChatMessagesProvider initialMessages={messages}>
 *   <YourChatComponent />
 * </ChatMessagesProvider>
 * ```
 */
export function ChatMessagesProvider({ children, initialMessages }: ChatMessagesProviderProps) {
  const messagesHook = useChatMessages(initialMessages);

  return (
    <ChatMessagesContext.Provider value={messagesHook}>
      {children}
    </ChatMessagesContext.Provider>
  );
}

/**
 * Hook to access chat messages context
 *
 * @throws Error if used outside ChatMessagesProvider
 */
export function useChatMessagesContext(): ChatMessagesContextValue {
  const context = useContext(ChatMessagesContext);
  if (!context) {
    throw new Error('useChatMessagesContext must be used within ChatMessagesProvider');
  }
  return context;
}

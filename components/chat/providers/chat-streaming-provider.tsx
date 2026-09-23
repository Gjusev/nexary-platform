'use client';

/**
 * ChatStreamingProvider Component
 *
 * Provider component that wraps useChatStreaming hook and exposes
 * streaming functionality through React context.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useChatStreaming, type ModelInfo, type ThinkingState } from '@/hooks/chat';

interface ChatStreamingContextValue {
  thinkingState: ThinkingState;
  currentReasoning: string;
  modelInfo: ModelInfo | null;
  isStreaming: boolean;

  startStream: (options: {
    conversationSlug: string;
    messageContent: string;
    ragPackageIds: string[];
    systemPrompt?: string;
    webSearchEnabled?: boolean;
    provider?: string;
    model?: string;
    onContentChunk?: (content: string) => void;
    onReasoningChunk?: (reasoning: string) => void;
    onModelInfo?: (info: ModelInfo) => void;
    onSources?: (sources: any[]) => void;
    onWebSources?: (sources: any[]) => void;
    onDone?: (messageId: string, tempMessageId: string) => void;
    onError?: (error: Error) => void;
  }) => Promise<void>;

  stopStream: () => void;
  resetState: () => void;
}

const ChatStreamingContext = createContext<ChatStreamingContextValue | undefined>(undefined);

export interface ChatStreamingProviderProps {
  children: ReactNode;
}

/**
 * Provider component for chat streaming management
 *
 * @example
 * ```tsx
 * <ChatStreamingProvider>
 *   <YourChatComponent />
 * </ChatStreamingProvider>
 * ```
 */
export function ChatStreamingProvider({ children }: ChatStreamingProviderProps) {
  const streamingHook = useChatStreaming();

  return (
    <ChatStreamingContext.Provider value={streamingHook}>
      {children}
    </ChatStreamingContext.Provider>
  );
}

/**
 * Hook to access chat streaming context
 *
 * @throws Error if used outside ChatStreamingProvider
 */
export function useChatStreamingContext(): ChatStreamingContextValue {
  const context = useContext(ChatStreamingContext);
  if (!context) {
    throw new Error('useChatStreamingContext must be used within ChatStreamingProvider');
  }
  return context;
}

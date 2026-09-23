/**
 * useChatMessages Hook
 *
 * Manages chat message state and CRUD operations.
 * Handles message updates, metadata management, and message actions.
 */

import { useState, useCallback } from 'react';
import type { ChatMessage, Conversation } from './types';

interface MessageMetadata {
  model?: string;
  modelName?: string;
  provider?: string;
  [key: string]: any;
}

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  messageSources: Record<string, any[]>;
  webSearchSources: Record<string, any[]>;
  messageReasoning: Record<string, string>;
  messageModelInfo: Record<string, { provider: string; model: string; modelName: string }>;
  pinnedMessages: Set<string>;
  messageFeedback: Record<string, 'up' | 'down'>;

  // Message operations
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageMetadata: (id: string, metadata: MessageMetadata) => void;

  // Message actions
  pinMessage: (id: string) => void;
  setMessageFeedback: (id: string, type: 'up' | 'down') => void;

  // Source management
  setMessageSources: (messageId: string, sources: any[]) => void;
  setWebSearchSources: (messageId: string, sources: any[]) => void;
  setMessageReasoning: (messageId: string, reasoning: string) => void;
  setMessageModelInfo: (messageId: string, info: { provider: string; model: string; modelName: string }) => void;

  // Transfer utilities (for when temp IDs become real IDs)
  transferMessageData: (fromId: string, toId: string) => void;

  // Bulk operations
  replaceMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

/**
 * Hook for managing chat messages
 *
 * @example
 * ```tsx
 * const { messages, addMessage, updateMessageContent } = useChatMessages();
 *
 * const handleNewMessage = (content: string) => {
 *   addMessage({
 *     id: 'msg-1',
 *     role: 'user',
 *     content: 'Hello!',
 *     createdAt: new Date().toISOString(),
 *   });
 * };
 * ```
 */
export function useChatMessages(initialMessages: ChatMessage[] = []): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [messageSources, setMessageSourcesState] = useState<Record<string, any[]>>({});
  const [webSearchSources, setWebSearchSourcesState] = useState<Record<string, any[]>>({});
  const [messageReasoning, setMessageReasoningState] = useState<Record<string, string>>({});
  const [messageModelInfo, setMessageModelInfoState] = useState<Record<string, { provider: string; model: string; modelName: string }>>({});
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [messageFeedback, setMessageFeedbackState] = useState<Record<string, 'up' | 'down'>>({});

  /**
   * Add a new message to the conversation
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  /**
   * Update a message (partial update)
   */
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  /**
   * Update only the content of a message
   * Optimized for streaming updates
   */
  const updateMessageContent = useCallback((id: string, content: string) => {
    setMessages(prev => {
      const messages = [...prev];
      const index = messages.findIndex(m => m.id === id);
      if (index !== -1) {
        messages[index] = { ...messages[index], content };
      }
      return messages;
    });
  }, []);

  /**
   * Update metadata for a message
   */
  const updateMessageMetadata = useCallback((id: string, metadata: MessageMetadata) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === id) {
          return {
            ...msg,
            metadata: {
              ...msg.metadata,
              ...metadata,
            },
          };
        }
        return msg;
      })
    );
  }, []);

  /**
   * Pin/unpin a message
   */
  const pinMessage = useCallback((id: string) => {
    setPinnedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  /**
   * Set feedback for a message (upvote/downvote)
   * Toggles off if same feedback is given again
   */
  const setMessageFeedback = useCallback((id: string, type: 'up' | 'down') => {
    setMessageFeedbackState(prev => {
      const current = prev[id];
      // Toggle off if same feedback
      if (current === type) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      // Set new feedback
      return { ...prev, [id]: type };
    });
  }, []);

  /**
   * Set RAG sources for a message
   */
  const setMessageSources = useCallback((messageId: string, sources: any[]) => {
    setMessageSourcesState(prev => ({
      ...prev,
      [messageId]: sources,
    }));
  }, []);

  /**
   * Set web search sources for a message
   */
  const setWebSearchSources = useCallback((messageId: string, sources: any[]) => {
    setWebSearchSourcesState(prev => ({
      ...prev,
      [messageId]: sources,
    }));
  }, []);

  /**
   * Set reasoning text for a message
   */
  const setMessageReasoning = useCallback((messageId: string, reasoning: string) => {
    setMessageReasoningState(prev => ({
      ...prev,
      [messageId]: reasoning,
    }));
  }, []);

  /**
   * Set model info for a message
   */
  const setMessageModelInfo = useCallback((messageId: string, info: { provider: string; model: string; modelName: string }) => {
    setMessageModelInfoState(prev => ({
      ...prev,
      [messageId]: info,
    }));
  }, []);

  /**
   * Transfer all data from one message ID to another
   * Used when temporary message IDs are replaced with real IDs
   */
  const transferMessageData = useCallback((fromId: string, toId: string) => {
    // Transfer RAG sources
    setMessageSourcesState(prev => {
      if (prev[fromId]) {
        const { [fromId]: sources, ...rest } = prev;
        return { ...rest, [toId]: sources };
      }
      return prev;
    });

    // Transfer web sources
    setWebSearchSourcesState(prev => {
      if (prev[fromId]) {
        const { [fromId]: sources, ...rest } = prev;
        return { ...rest, [toId]: sources };
      }
      return prev;
    });

    // Transfer reasoning
    setMessageReasoningState(prev => {
      if (prev[fromId]) {
        const { [fromId]: reasoning, ...rest } = prev;
        return { ...rest, [toId]: reasoning };
      }
      return prev;
    });

    // Transfer model info
    setMessageModelInfoState(prev => {
      if (prev[fromId]) {
        const { [fromId]: info, ...rest } = prev;
        return { ...rest, [toId]: info };
      }
      return prev;
    });

    // Update message ID in messages array
    setMessages(prev => {
      const messages = [...prev];
      const index = messages.findIndex(m => m.id === fromId);
      if (index !== -1) {
        messages[index] = { ...messages[index], id: toId };
      }
      return messages;
    });

    // Transfer pinned state
    setPinnedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fromId)) {
        newSet.delete(fromId);
        newSet.add(toId);
      }
      return newSet;
    });

    // Transfer feedback
    setMessageFeedbackState(prev => {
      if (prev[fromId]) {
        const { [fromId]: feedback, ...rest } = prev;
        return { ...rest, [toId]: feedback };
      }
      return prev;
    });
  }, []);

  /**
   * Replace all messages
   */
  const replaceMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    messageSources,
    webSearchSources,
    messageReasoning,
    messageModelInfo,
    pinnedMessages,
    messageFeedback,
    addMessage,
    updateMessage,
    updateMessageContent,
    updateMessageMetadata,
    pinMessage,
    setMessageFeedback,
    setMessageSources,
    setWebSearchSources,
    setMessageReasoning,
    setMessageModelInfo,
    transferMessageData,
    replaceMessages,
    clearMessages,
  };
}

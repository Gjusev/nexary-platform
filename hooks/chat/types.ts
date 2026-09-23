/**
 * Shared types for chat hooks
 */

import type { AIProvider } from '@/lib/ai-providers';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, any>;
};

export type Conversation = {
  id: string;
  slug: string;
  title: string;
  ragPackageIds: string[];
  provider: AIProvider;
  model: string;
  useSmartSelector: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
  hasMoreMessages?: boolean;
};

export type ThinkingState = 'idle' | 'thinking' | 'reasoning' | 'streaming';

export interface CreateConversationOptions {
  title: string;
  ragPackageIds: string[];
  provider: AIProvider;
  model: string;
  useSmartSelector: boolean;
  assistantId?: string | null;
}

export interface ModelInfo {
  provider: AIProvider;
  model: string;
  modelName: string;
  hasReasoning: boolean;
}

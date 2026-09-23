/**
 * useChatNavigation Hook
 *
 * Handles conversation creation with optimistic UI and smooth navigation.
 * Manages the transition from /chat to /chat/[id] without page reloads.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Conversation, CreateConversationOptions } from './types';

interface UseChatNavigationProps {
  onCreateConversation?: (options: CreateConversationOptions) => Promise<Conversation>;
}

interface UseChatNavigationReturn {
  isCreatingConversation: boolean;
  isTransitioning: boolean;
  transitionDirection: 'enter' | 'exit';
  createOptimisticConversation: (
    options: CreateConversationOptions,
    onOptimisticUpdate: (conversation: Conversation) => void,
    onError: (error: Error, restoredMessage: string) => void
  ) => Promise<Conversation | null>;
}

/**
 * Hook for managing chat navigation with optimistic UI
 *
 * @example
 * ```tsx
 * const { createOptimisticConversation, isCreatingConversation } = useChatNavigation();
 *
 * const handleSendMessage = async () => {
 *   if (!activeConversation) {
 *     const conversation = await createOptimisticConversation(
 *       { title: messageContent, ... },
 *       (conv) => setActiveConversation(conv),
 *       (err) => toast({ title: 'Error', description: err.message })
 *     );
 *   }
 * };
 * ```
 */
export function useChatNavigation(options?: UseChatNavigationProps): UseChatNavigationReturn {
  const router = useRouter();
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'enter' | 'exit'>('enter');

  /**
   * Create a conversation with optimistic UI
   *
   * This creates a temporary conversation immediately, navigates to it,
   * and then replaces it with the real conversation from the API.
   */
  const createOptimisticConversation = useCallback(
    async (
      createOptions: CreateConversationOptions,
      onOptimisticUpdate: (conversation: Conversation) => void,
      onError: (error: Error, restoredMessage: string) => void
    ): Promise<Conversation | null> => {
      setIsCreatingConversation(true);
      setTransitionDirection('enter');

      // Generate a temporary ID for optimistic UI
      const tempId = `temp-${Date.now()}`;
      const tempSlug = `temp-${tempId}`;

      // Create optimistic conversation immediately
      const optimisticConversation: Conversation = {
        id: tempId,
        slug: tempSlug,
        title: createOptions.title,
        ragPackageIds: createOptions.ragPackageIds,
        provider: createOptions.provider,
        model: createOptions.model,
        useSmartSelector: createOptions.useSmartSelector,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        hasMoreMessages: false,
      };

      // Notify parent component of optimistic update
      onOptimisticUpdate(optimisticConversation);

      // Navigate immediately to the new URL (will use temp slug initially)
      setIsTransitioning(true);
      router.push(`/chat/${tempSlug}`);

      try {
        // Call API to create real conversation
        const createFn = options?.onCreateConversation || defaultCreateConversation;
        const createdConversation = await createFn(createOptions);

        // Replace temp conversation with real one (parent handles state update)
        // Navigate to the real slug (will be smooth since we're already in a chat view)
        if (createdConversation.slug !== tempSlug) {
          router.replace(`/chat/${createdConversation.slug}`);
        }

        setIsCreatingConversation(false);
        setIsTransitioning(false);
        return createdConversation;
      } catch (error) {
        console.error('Error creating conversation:', error);

        // Restore state on error
        setIsCreatingConversation(false);
        setIsTransitioning(false);

        const err = error instanceof Error ? error : new Error('Failed to create conversation');
        onError(err, createOptions.title);

        // Navigate back to chat list
        router.push('/chat');
        return null;
      }
    },
    [router, options]
  );

  return {
    isCreatingConversation,
    isTransitioning,
    transitionDirection,
    createOptimisticConversation,
  };
}

/**
 * Default implementation for creating a conversation
 * Can be overridden by passing onCreateConversation to the hook
 */
async function defaultCreateConversation(
  options: CreateConversationOptions
): Promise<Conversation> {
  const res = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: options.title,
      ragPackageIds: options.ragPackageIds,
      provider: options.provider,
      model: options.model,
      useSmartSelector: options.useSmartSelector,
      assistantId: options.assistantId || null,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create conversation');
  }

  return {
    ...data.conversation,
    ragPackageIds: data.conversation.ragPackageIds || [],
    hasMoreMessages: data.conversation.hasMoreMessages ?? false,
  };
}

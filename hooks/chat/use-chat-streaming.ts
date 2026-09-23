/**
 * useChatStreaming Hook
 *
 * Handles the streaming of AI responses with Server-Sent Events (SSE).
 * Manages thinking states, content accumulation, and error handling.
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import type { ThinkingState, ModelInfo } from './types';

interface StreamOptions {
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
}

interface UseChatStreamingReturn {
  thinkingState: ThinkingState;
  currentReasoning: string;
  modelInfo: ModelInfo | null;
  isStreaming: boolean;
  startStream: (options: StreamOptions) => Promise<void>;
  stopStream: () => void;
  resetState: () => void;
}

/**
 * Hook for managing chat message streaming
 *
 * @example
 * ```tsx
 * const { thinkingState, startStream, stopStream } = useChatStreaming();
 *
 * const handleSend = async () => {
 *   await startStream({
 *     conversationSlug: 'my-conversation',
 *     messageContent: 'Hello!',
 *     ragPackageIds: [],
 *     onContentChunk: (content) => setMessage(prev => prev + content),
 *   });
 * };
 * ```
 */
export function useChatStreaming(): UseChatStreamingReturn {
  const t = useTranslations('chat');
  const { toast } = useToast();

  const [thinkingState, setThinkingState] = useState<ThinkingState>('idle');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Get user-friendly error title based on error code
   */
  function getErrorTitle(code: string, t: (key: string) => string): string {
    const errorTitles: Record<string, string> = {
      'INSUFFICIENT_CREDITS': t('insufficientCredits') || 'Insufficient Credits',
      'MODEL_NOT_AVAILABLE': t('modelNotAvailable') || 'Model Not Available',
      'MODEL_DEPRECATED': t('modelDeprecated') || 'Model Deprecated',
      'AI_PROVIDER_ERROR': t('aiProviderError') || 'AI Provider Error',
      'CONTENT_FILTER': t('contentFilter') || 'Content Filtered',
      'CONTEXT_LENGTH_EXCEEDED': t('contextLengthExceeded') || 'Conversation Too Long',
      'RATE_LIMIT_ERROR': t('rateLimitExceeded') || 'Rate Limit Exceeded',
      'AUTHENTICATION_ERROR': t('authenticationError') || 'Authentication Error',
    };
    return errorTitles[code] || (t('error') || 'Error');
  }

  /**
   * Get user-friendly error message (simplified, no technical details)
   */
  function getUserFriendlyMessage(code: string | undefined, t: (key: string) => string): string {
    if (!code) {
      return t('errorMessage') || 'Something went wrong. Please try again.';
    }

    const userMessages: Record<string, string> = {
      'INSUFFICIENT_CREDITS': t('insufficientCreditsMessage') || 'Please check your account balance and try again.',
      'MODEL_NOT_AVAILABLE': t('modelNotAvailableMessage') || 'Please try a different model or contact support.',
      'MODEL_DEPRECATED': t('modelDeprecatedMessage') || 'Please select a newer model from the settings.',
      'AI_PROVIDER_ERROR': t('aiProviderErrorMessage') || 'There\'s an issue with the AI service. Please try again.',
      'CONTENT_FILTER': t('contentFilterMessage') || 'Please rephrase your message and try again.',
      'CONTEXT_LENGTH_EXCEEDED': t('contextLengthExceededMessage') || 'Please start a new conversation to continue.',
      'RATE_LIMIT_ERROR': t('rateLimitMessage') || 'Please wait a moment and try again.',
      'AUTHENTICATION_ERROR': t('authenticationErrorMessage') || 'Please log in again to continue.',
    };

    return userMessages[code] || (t('errorMessage') || 'Something went wrong. Please try again.');
  }

  /**
   * Reset all streaming states to initial values
   */
  const resetState = useCallback(() => {
    setThinkingState('idle');
    setCurrentReasoning('');
    setModelInfo(null);
    setIsStreaming(false);
  }, []);

  /**
   * Stop the current stream
   */
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setThinkingState('idle');
  }, []);

  /**
   * Start streaming a response from the AI
   */
  const startStream = useCallback(async (options: StreamOptions) => {
    const {
      conversationSlug,
      messageContent,
      ragPackageIds,
      systemPrompt,
      webSearchEnabled = false,
      provider = 'openai',
      model = 'gpt-4o-mini',
      onContentChunk,
      onReasoningChunk,
      onModelInfo,
      onSources,
      onWebSources,
      onDone,
      onError,
    } = options;

    setThinkingState('thinking');
    setCurrentReasoning('');
    setModelInfo(null);
    setIsStreaming(true);

    // Create abort controller for this stream
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/chat/conversations/${conversationSlug}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          ragPackageIds,
          systemPrompt,
          webSearchEnabled,
          provider,
          model,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));

        // Handle different error types with specific, user-friendly messages
        const errorTitle = errorData.code ? getErrorTitle(errorData.code, t) : (t('error') || 'Error');
        const errorDescription = getUserFriendlyMessage(errorData.code, t);

        // Show toast notification
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: 'destructive',
          duration: 5000,
        });

        const error = new Error(errorData.error || `HTTP ${res.status}`);
        (error as any).code = errorData.code;
        (error as any).userMessage = errorDescription; // Store user-friendly message
        onError?.(error);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let assistantMessageId = `temp-assistant-${Date.now()}`;
      let buffer = '';
      let streamDone = false;

      if (!reader) {
        throw new Error('No reader available');
      }

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('📡 Reader done, total message length:', assistantMessage.length);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);

          // Check for stream end
          if (data === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);

            // Handle model-info event
            if (parsed.type === 'model-info') {
              const info: ModelInfo = {
                provider: parsed.provider,
                model: parsed.model,
                modelName: parsed.modelName,
                hasReasoning: parsed.hasReasoning,
              };
              setModelInfo(info);
              onModelInfo?.(info);
              continue;
            }

            // Handle reasoning event
            if (parsed.type === 'reasoning') {
              console.log('🧠 Reasoning received:', parsed.content);
              setCurrentReasoning(prev => prev + parsed.content);
              setThinkingState('reasoning');
              onReasoningChunk?.(parsed.content);
              continue;
            }

            // Handle completion event
            if (parsed.type === 'done') {
              console.log('✅ Stream completed, messageId:', parsed.messageId);
              onDone?.(parsed.messageId, assistantMessageId);
              streamDone = true;
              break;
            }

            // Handle RAG sources event
            if (parsed.type === 'sources') {
              console.log('📚 Received sources:', parsed.sources);
              onSources?.(parsed.sources || []);
              continue;
            }

            // Handle web sources event
            if (parsed.type === 'web-sources') {
              console.log('🌐 Received web sources:', parsed.sources);
              onWebSources?.(parsed.sources || []);
              continue;
            }

            // Handle smart selector event
            if (parsed.type === 'smart-selector') {
              console.log('🧠 Smart Selector activated:', parsed);
              toast({
                title: '🧠 Smart Selector',
                description: `Using ${parsed.modelName}: ${parsed.reason}`,
                duration: 5000,
              });
              continue;
            }

            // Handle warning event
            if (parsed.type === 'warning') {
              console.warn('⚠️ Warning:', parsed.message);
              toast({
                title: 'Warning',
                description: parsed.message,
                variant: 'default',
                duration: 5000,
              });
              continue;
            }

            // Handle error event
            if (parsed.type === 'error') {
              console.error('❌ Stream error:', parsed.error);
              continue;
            }

            // Handle content event
            if (parsed.type === 'content') {
              const content = parsed.content;

              // Transition to streaming state
              if (thinkingState === 'thinking' || thinkingState === 'reasoning') {
                setThinkingState('streaming');
              }

              assistantMessage += content;
              onContentChunk?.(content);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e, 'Data:', data);
          }
        }

        if (streamDone) break;
      }

      console.log('🎉 Stream fully processed. Final message length:', assistantMessage.length);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('🛑 Stream aborted by user');
        toast({
          title: t('generationStopped') || 'Generation stopped',
          description: t('generationStoppedDesc') || 'Response generation was cancelled',
        });
      } else {
        console.error('Error streaming message:', error);
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError?.(err);
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setThinkingState('idle');
    }
  }, [t, toast, thinkingState]);

  return {
    thinkingState,
    currentReasoning,
    modelInfo,
    isStreaming,
    startStream,
    stopStream,
    resetState,
  };
}

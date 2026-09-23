'use client';

/**
 * Thinking Indicator Component
 *
 * Displays an animated indicator while waiting for AI response.
 * Shows model name and optional reasoning text for o1 models.
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIProvider } from '@/lib/ai-providers';

interface ThinkingIndicatorProps {
  /** Model ID (e.g., 'gpt-4o', 'o1-mini') */
  model: string;
  /** Model display name */
  modelName: string;
  /** AI provider */
  provider: AIProvider;
  /** Whether the model supports reasoning output */
  hasReasoning?: boolean;
  /** Current reasoning text (streaming) */
  reasoning?: string;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Thinking indicator component with model info and optional reasoning display.
 *
 * @example
 * ```tsx
 * <ThinkingIndicator
 *   model="o1-mini"
 *   modelName="o1 Mini"
 *   provider="openai"
 *   hasReasoning={true}
 *   reasoning="Let me think about this..."
 * />
 * ```
 */
export function ThinkingIndicator({
  model,
  modelName,
  provider,
  hasReasoning = false,
  reasoning = '',
  className,
}: ThinkingIndicatorProps) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  // Auto-expand reasoning when content arrives
  useEffect(() => {
    if (reasoning && hasReasoning && !isExpanded) {
      setIsExpanded(true);
      setShowPulse(false);
    }
  }, [reasoning, hasReasoning, isExpanded]);

  const getProviderBadgeColor = (provider: AIProvider) => {
    switch (provider) {
      case 'openai':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
      case 'gemini':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'mistral':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  const getProviderIcon = (provider: AIProvider) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'gemini':
        return '✨';
      case 'mistral':
        return '🧠';
      default:
        return '💡';
    }
  };

  return (
    <div className={cn('flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300', className)}>
      {/* Model Info Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Animated Brain Icon */}
          <div className={cn(
            'relative',
            showPulse && 'animate-pulse'
          )}>
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-ping" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              {hasReasoning ? (
                <Brain className="h-4 w-4 text-primary" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
            </div>
          </div>

          {/* Model Name Badge */}
          <Badge
            variant="outline"
            className={cn(
              'font-medium text-xs py-1 px-2.5',
              getProviderBadgeColor(provider)
            )}
          >
            <span className="mr-1.5">{getProviderIcon(provider)}</span>
            {modelName}
          </Badge>
        </div>

        {/* Status Text */}
        <span className="text-xs text-muted-foreground">
          {hasReasoning && reasoning ? t('reasoning') : t('thinking')}
        </span>
      </div>

      {/* Reasoning Text (for o1 models) */}
      {hasReasoning && reasoning && (
        <div className="relative">
          {/* Collapsible Reasoning Display */}
          <div
            className={cn(
              'rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground transition-all duration-200',
              isExpanded ? 'max-h-96 overflow-y-auto' : 'max-h-20 overflow-hidden'
            )}
          >
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap font-mono text-xs">{reasoning}</p>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          {reasoning.length > 100 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 h-6 px-2 text-xs bg-background/80 hover:bg-background border border-border/50 shadow-sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  {tCommon('showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  {tCommon('showMore')}
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Animated Dots (when no reasoning yet) */}
      {(!hasReasoning || !reasoning) && (
        <div className="flex items-center gap-1">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
          </span>
          <span className="flex h-2 w-2 animation-delay-200">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
          </span>
          <span className="flex h-2 w-2 animation-delay-400">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
          </span>
        </div>
      )}

      <style jsx>{`
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </div>
  );
}

'use client';

/**
 * Chat Messages Component
 *
 * Displays the list of messages in a conversation with:
 * - Message rendering (user/assistant/system)
 * - Source citations
 * - Web search results
 * - Feedback buttons
 * - Copy functionality
 * - Report/Protocol card display
 * - Code syntax highlighting
 * - Mermaid diagrams
 */

import { forwardRef, Fragment, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Pin, ThumbsUp, ThumbsDown, FileText, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeBlock } from '@/components/code-block';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { ReportCard } from '@/components/chat/report-card';
import { RagVisualization } from '@/components/rag/rag-visualization';
import { ChartMessage, type ChartMessageData } from '@/components/chat/chart-message';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { type Protocol } from '@/types/protocol';
import { downloadReportAsPDF } from '@/lib/export-utils';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

interface ChatMessagesProps {
  /** Array of messages to display */
  messages: ChatMessage[];
  /** Whether older messages are being loaded */
  loadingOlderMessages?: boolean;
  /** Set of pinned message IDs */
  pinnedMessages: Set<string>;
  /** Message feedback state */
  messageFeedback: Record<string, 'up' | 'down'>;
  /** Message sources (RAG) by message ID */
  messageSources: Record<string, Array<{ content: string; score?: number; metadata?: Record<string, unknown> }>>;
  /** Web search sources by message ID */
  webSearchSources: Record<string, Array<{ title: string; url: string; snippet?: string }>>;
  /** Callback when a message is pinned */
  onPinMessage: (messageId: string) => void;
  /** Callback when feedback is given */
  onFeedback: (messageId: string, feedback: 'up' | 'down') => void;
  /** Callback when regenerate is clicked */
  onRegenerate: (messageId: string) => void;
  /** Callback when viewing a report */
  onViewReport: (report: Protocol) => void;
  /** Whether viewport is mobile */
  isMobileViewport?: boolean;
  /** Ref for messages end (for auto-scroll) */
  messagesEndRef?: RefObject<HTMLDivElement>;
  /** Scroll area ref */
  scrollAreaRef?: RefObject<HTMLDivElement>;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Helper to safely parse report JSON from message content.
 */
function tryParseReport(content: string): Protocol | null {
  try {
    // Clean up markdown code blocks if present
    const cleanContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleanContent);
    if (parsed.title && parsed.date && Array.isArray(parsed.tasks)) {
      return parsed as Protocol;
    }
  } catch (e) {
    return null;
  }
  return null;
}

/**
 * Custom paragraph renderer to style source citations.
 */
function ParagraphWithSources({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  // Process children to find and style [Source: ...] patterns
  const processChildren = (child: React.ReactNode): React.ReactNode => {
    if (typeof child === 'string') {
      // Match [Source: filename] pattern
      const sourcePattern = /\[Source:\s*([^\]]+)\]/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = sourcePattern.exec(child)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        // Add styled source badge
        const filename = match[1].trim();
        parts.push(
          <span
            key={match.index}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 text-xs bg-primary/10 text-primary rounded-full border border-primary/20 font-medium"
          >
            <FileText className="h-3 w-3" />
            {filename}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }

      return parts.length > 0 ? parts : child;
    }
    return child;
  };

  const processedChildren = Array.isArray(children)
    ? children.map(processChildren)
    : processChildren(children);

  return <p {...props}>{processedChildren}</p>;
}

/**
 * Chat messages display component.
 *
 * @example
 * ```tsx
 * <ChatMessages
 *   messages={activeConversation.messages || []}
 *   loadingOlderMessages={loadingOlderMessages}
 *   pinnedMessages={pinnedMessages}
 *   messageFeedback={messageFeedback}
 *   messageSources={messageSources}
 *   webSearchSources={webSearchSources}
 *   onPinMessage={handlePinMessage}
 *   onFeedback={handleFeedback}
 *   onRegenerate={handleRegenerate}
 *   onViewReport={(report) => { setViewingReport(report); setIsReportViewerOpen(true); }}
 *   isMobileViewport={isMobileViewport}
 *   messagesEndRef={messagesEndRef}
 *   scrollAreaRef={scrollAreaRef}
 * />
 * ```
 */
export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(
  (
    {
      messages,
      loadingOlderMessages = false,
      pinnedMessages,
      messageFeedback,
      messageSources,
      webSearchSources,
      onPinMessage,
      onFeedback,
      onRegenerate,
      onViewReport,
      isMobileViewport = false,
      messagesEndRef,
      scrollAreaRef,
      className,
    },
    ref
  ) => {
    const t = useTranslations('chat');
    const { toast } = useToast();

    const handleCopyMessage = (content: string) => {
      navigator.clipboard.writeText(content);
      toast({
        title: t('copied') || 'Copied',
        description: t('responseCopied') || 'Response copied to clipboard',
      });
    };

    return (
      <ScrollArea ref={scrollAreaRef} className={`flex-1 px-3 sm:px-6 ${className || ''}`}>
        <div
          className={`mx-auto max-w-3xl space-y-4 pt-4 sm:space-y-5 sm:pt-5 ${
            isMobileViewport ? 'pb-[calc(env(safe-area-inset-bottom)+2rem)]' : 'pb-2'
          }`}
        >
          {loadingOlderMessages && (
            <div className="flex justify-center py-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {messages.length > 0 ? (
            messages.map((message, idx) => (
              <div key={message.id} className="space-y-2">
                {/* Assistant message header */}
                {message.role === 'assistant' && (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                        <Image
                          src="/nexary-logo.webp"
                          alt={t('azureOpenAI') || 'Nexary AI'}
                          width={24}
                          height={24}
                          className="h-5 w-5 rounded-full bg-white"
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {t('azureOpenAI') || 'Nexary AI'}
                      </span>
                      {pinnedMessages.has(message.id) && (
                        <Pin className="h-3 w-3 text-primary fill-primary" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onPinMessage(message.id)}
                      title={
                        pinnedMessages.has(message.id)
                          ? t('unpinMessage') || 'Unpin'
                          : t('pinMessage') || 'Pin'
                      }
                    >
                      <Pin
                        className={`h-3.5 w-3.5 ${
                          pinnedMessages.has(message.id)
                            ? 'fill-current text-primary'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </Button>
                  </div>
                )}

                {/* Message content */}
                <div
                  className={
                    message.role === 'user'
                      ? 'ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground sm:max-w-[70%]'
                      : 'max-w-[85%] sm:max-w-[70%]'
                  }
                >
                  {message.role === 'assistant' ? (
                    (() => {
                      const report = tryParseReport(message.content);
                      const chartData = message.metadata?.chart as ChartMessageData | undefined;

                      // Render report card if present
                      if (report) {
                        return (
                          <div className="my-2">
                            <ReportCard
                              protocol={report}
                              onViewFull={() => onViewReport(report)}
                              onDownload={() => downloadReportAsPDF(report)}
                            />
                          </div>
                        );
                      }

                      return (
                        <>
                          {/* Render chart if present in metadata */}
                          {chartData && (
                            <div className="my-3">
                              <ChartMessage chart={chartData} />
                            </div>
                          )}

                          <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-transparent prose-pre:p-0">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const codeString = String(children).replace(/\n$/, '');

                                  // Handle mermaid diagrams
                                  if (match?.[1] === 'mermaid') {
                                    return <MermaidDiagram code={codeString} />;
                                  }

                                  // Handle code blocks with syntax highlighting
                                  if (match) {
                                    return <CodeBlock language={match[1]} code={codeString} />;
                                  }

                                  // Inline code
                                  return (
                                    <code
                                      className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                                pre({ children }) {
                                  // Let the code component handle the wrapper
                                  return <>{children}</>;
                                },
                                // Custom paragraph renderer to style source citations
                                p: ParagraphWithSources,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>

                          {/* Sources Panel (RAG) */}
                          {messageSources[message.id]?.length > 0 && (
                            <RagVisualization
                              sources={messageSources[message.id].map((source, idx) => ({
                                id: `source-${idx}`,
                                filename: (source.metadata?.filename as string) || 'Unknown',
                                content: source.content,
                                score: source.score || 0,
                                metadata: source.metadata,
                              }))}
                              className="mt-4"
                            />
                          )}

                          {/* Web Search Sources Panel */}
                          {webSearchSources[message.id]?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Globe className="h-3 w-3" />
                                {t('webResults') || 'Sources'}:
                              </span>
                              {webSearchSources[message.id].map((source: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted/50 hover:bg-muted rounded-full border border-border/50 text-muted-foreground hover:text-foreground transition-colors max-w-[200px]"
                                  title={source.title}
                                >
                                  <span className="truncate">
                                    {source.source || new URL(source.url).hostname}
                                  </span>
                                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopyMessage(message.content)}
                            >
                              <svg
                                className="mr-1.5 h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              {t('copy') || 'Copy'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => onRegenerate(message.id)}
                            >
                              <svg
                                className="mr-1.5 h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              {t('regenerate') || 'Regenerate'}
                            </Button>

                            {/* Separator */}
                            <div className="h-4 w-px bg-border mx-1" />

                            {/* Feedback buttons */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                messageFeedback[message.id] === 'up'
                                  ? 'text-green-600 bg-green-50 dark:bg-green-950'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              onClick={() => onFeedback(message.id, 'up')}
                              title={t('helpfulResponse') || 'Helpful'}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                messageFeedback[message.id] === 'down'
                                  ? 'text-red-600 bg-red-50 dark:bg-red-950'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              onClick={() => onFeedback(message.id, 'down')}
                              title={t('notHelpfulResponse') || 'Not helpful'}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      );
                    })()
                  ) : message.role === 'system' ? (
                    <div className="rounded-2xl bg-muted/70 px-4 py-2 text-xs text-muted-foreground">
                      {message.content}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
                  )}
                </div>

                {/* Ref at last element for auto-scroll */}
                {idx === messages.length - 1 && <div ref={messagesEndRef} />}
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('startConversation') || 'Start a conversation'}
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }
);

ChatMessages.displayName = 'ChatMessages';

'use client';

/**
 * Chat Input Component
 *
 * Handles message input with:
 * - Textarea with auto-resize
 * - File upload button
 * - RAG package selector toggle
 * - Web search toggle
 * - Model selector
 * - Export menu
 * - Send/Stop generation buttons
 * - Welcome screen when no active conversation
 * - Assistant context questions and sample prompts
 */

import { useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Mic,
  ArrowUp,
  Database,
  Plus,
  Square,
  Globe,
  Download,
  FileText,
  FileJson,
  Printer,
  Loader2,
  Sparkles,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatModelSelector } from '@/components/chat/model-selector';
import {
  downloadConversationAsMarkdown,
  downloadConversationAsJSON,
  printConversationAsPDF,
} from '@/lib/export-utils';
import type { AIProvider } from '@/lib/ai-providers';
import type { ExportConversation } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type Assistant = {
  id: string;
  name: string;
  icon?: string;
  avatar_color?: string;
  description?: string;
  welcome_message?: string;
  context_questions?: string[];
  sample_prompts?: string[];
};

interface ChatInputProps {
  /** Current message input value */
  newMessage: string;
  /** Callback when message changes */
  onMessageChange: (message: string) => void;
  /** Callback when send message is triggered */
  onSendMessage: () => void;
  /** Callback when stop generation is triggered */
  onStopGeneration?: () => void;
  /** Callback when key is pressed */
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Callback when file upload button is clicked */
  onFileUploadClick: () => void;
  /** Whether a message is being sent */
  sending: boolean;
  /** Whether a conversation is being created */
  creatingConversation: boolean;
  /** Whether files are being uploaded */
  uploadingFiles?: boolean;
  /** Callback when RAG slider is toggled */
  onToggleRagSlider: () => void;
  /** Whether web search is enabled */
  webSearchEnabled: boolean;
  /** Callback when web search is toggled */
  onToggleWebSearch: () => void;
  /** Selected AI provider */
  selectedProvider: AIProvider;
  /** Selected model */
  selectedModel: string;
  /** Whether smart selector is enabled */
  useSmartSelector: boolean;
  /** Callback when provider changes */
  onProviderChange: (provider: AIProvider) => void;
  /** Callback when model changes */
  onModelChange: (model: string) => void;
  /** Callback when smart selector changes */
  onSmartSelectorChange: (enabled: boolean) => void;
  /** Callback for export conversation */
  onExportConversation: (format: 'md' | 'json' | 'pdf') => void;
  /** Whether there's an active conversation */
  hasActiveConversation: boolean;
  /** Loaded assistant (for welcome screen) */
  loadedAssistant?: Assistant | null;
  /** Callback when sample prompt is clicked */
  onSamplePromptClick?: (prompt: string) => void;
  /** Whether to show scroll to bottom button */
  showScrollToBottom?: boolean;
  /** Callback when scroll to bottom is clicked */
  onScrollToBottom?: () => void;
  /** Whether viewport is mobile */
  isMobileViewport?: boolean;
  /** Whether to hide the welcome screen (when parent has its own) */
  hideWelcomeScreen?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Chat input component with message textarea and action buttons.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   newMessage={newMessage}
 *   onMessageChange={setNewMessage}
 *   onSendMessage={sendMessage}
 *   onStopGeneration={handleStopGeneration}
 *   onKeyDown={handleKeyDown}
 *   onFileUploadClick={() => filePickerRef.current?.click()}
 *   sending={sending}
 *   creatingConversation={creatingConversation}
 *   uploadingFiles={uploadingFiles}
 *   onToggleRagSlider={() => setShowRagSlider(true)}
 *   webSearchEnabled={webSearchEnabled}
 *   onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
 *   selectedProvider={selectedProvider}
 *   selectedModel={selectedModel}
 *   useSmartSelector={useSmartSelector}
 *   onProviderChange={setSelectedProvider}
 *   onModelChange={setSelectedModel}
 *   onSmartSelectorChange={setUseSmartSelector}
 *   onExportConversation={handleExportConversation}
 *   hasActiveConversation={!!activeConversation}
 *   loadedAssistant={loadedAssistant}
 *   onSamplePromptClick={(prompt) => { setNewMessage(prompt); sendMessage(); }}
 *   showScrollToBottom={isScrolledUp}
 *   onScrollToBottom={() => scrollToBottom('smooth')}
 *   isMobileViewport={isMobileViewport}
 * />
 * ```
 */
export function ChatInput({
  newMessage,
  onMessageChange,
  onSendMessage,
  onStopGeneration,
  onKeyDown,
  onFileUploadClick,
  sending,
  creatingConversation,
  uploadingFiles = false,
  onToggleRagSlider,
  webSearchEnabled,
  onToggleWebSearch,
  selectedProvider,
  selectedModel,
  useSmartSelector,
  onProviderChange,
  onModelChange,
  onSmartSelectorChange,
  onExportConversation,
  hasActiveConversation,
  loadedAssistant,
  onSamplePromptClick,
  showScrollToBottom = false,
  onScrollToBottom,
  isMobileViewport = false,
  hideWelcomeScreen = false,
  className,
}: ChatInputProps) {
  const t = useTranslations('chat');
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onMessageChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
  };

  const handleSamplePromptClick = (prompt: string) => {
    onSamplePromptClick?.(prompt);
  };

  const renderInputArea = () => (
    <div
      className="sticky bottom-0 z-10 bg-background/95 px-3 py-2 sm:px-4 sm:py-3 supports-[backdrop-filter]:bg-background/80 backdrop-blur-sm"
      style={{
        paddingBottom: isMobileViewport ? 'calc(env(safe-area-inset-bottom) + 0.5rem)' : '0.5rem',
      }}
    >
      <div className="mx-auto w-full max-w-3xl relative">
        {/* Scroll to bottom button */}
        {showScrollToBottom && onScrollToBottom && (
          <Button
            onClick={onScrollToBottom}
            size="icon"
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 h-9 w-9 rounded-full shadow-xl bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 border border-zinc-600 animate-in fade-in slide-in-from-bottom-2 duration-200"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        )}

        {/* Input container */}
        <div className="rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur">
          {/* Textarea with action buttons */}
          <div className="flex items-end gap-2 p-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={onKeyDown}
              placeholder={t('howCanWeHelp') || 'How can we help?'}
              className="min-h-[40px] max-h-[80px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/60"
              disabled={sending || creatingConversation}
            />
            <div className="flex items-center gap-1 pb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <Mic className="h-4 w-4" />
              </Button>
              {sending && onStopGeneration ? (
                <Button
                  type="button"
                  onClick={onStopGeneration}
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-full"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onSendMessage}
                  disabled={!newMessage.trim() || creatingConversation}
                  size="icon"
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {creatingConversation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center justify-between border-t border-border/40 px-2 py-1.5">
            <div className="flex items-center gap-1">
              {/* File upload button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onFileUploadClick}
                disabled={uploadingFiles}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>

              {/* RAG package selector */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onToggleRagSlider}
              >
                <Database className="h-3.5 w-3.5" />
              </Button>

              {/* Web search toggle */}
              <Button
                type="button"
                variant={webSearchEnabled ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 gap-1.5 rounded-lg px-2 text-xs ${
                  webSearchEnabled
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={onToggleWebSearch}
                title={t('webSearch') || 'Web search'}
              >
                <Globe className="h-3.5 w-3.5" />
              </Button>

              {/* Model selector */}
              <ChatModelSelector
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                useSmartSelector={useSmartSelector}
                onProviderChange={onProviderChange}
                onModelChange={onModelChange}
                onSmartSelectorChange={onSmartSelectorChange}
              />

              {/* Export menu */}
              {hasActiveConversation && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onExportConversation('md')}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t('exportMarkdown') || 'Export as Markdown'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExportConversation('json')}>
                      <FileJson className="mr-2 h-4 w-4" />
                      {t('exportJSON') || 'Export as JSON'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExportConversation('pdf')}>
                      <Printer className="mr-2 h-4 w-4" />
                      {t('exportPDF') || 'Print as PDF'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Right side: Assistant badge and hint */}
            <div className="flex items-center gap-2">
              {loadedAssistant && (
                <Badge variant="outline" className="text-xs flex items-center gap-1 h-6">
                  <span>{loadedAssistant.icon || '🤖'}</span>
                  <span className="max-w-[100px] truncate">{loadedAssistant.name}</span>
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground/60 hidden sm:block">
                {t('pressEnterToSend') || 'Press Enter to send'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Welcome screen when no active conversation
  const renderWelcomeScreen = () => (
    <>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-16">
        {loadedAssistant ? (
          <>
            {/* Assistant Avatar */}
            <div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-lg text-3xl"
              style={{ backgroundColor: loadedAssistant.avatar_color || '#6366f1' }}
            >
              {loadedAssistant.icon || '🤖'}
            </div>
            <h2 className="mb-2 text-2xl font-semibold text-foreground">{loadedAssistant.name}</h2>

            {/* Welcome Message */}
            {(loadedAssistant.welcome_message || loadedAssistant.description) && (
              <p className="max-w-lg text-sm text-muted-foreground mb-4">
                {loadedAssistant.welcome_message || loadedAssistant.description}
              </p>
            )}

            {/* Context Questions */}
            {loadedAssistant.context_questions && loadedAssistant.context_questions.length > 0 && (
              <div className="mb-6 max-w-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  {t('contextQuestionsIntro') || 'To help you better, please answer:'}
                </p>
                <div className="space-y-2">
                  {loadedAssistant.context_questions.map((question, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-left"
                    >
                      {idx + 1}. {question}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Prompts */}
            {loadedAssistant.sample_prompts && loadedAssistant.sample_prompts.length > 0 && (
              <div className="mb-4 max-w-lg">
                <p className="text-xs text-muted-foreground mb-3">
                  {t('samplePromptsIntro') || 'Quick suggestions:'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {loadedAssistant.sample_prompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
                      onClick={() => handleSamplePromptClick(prompt)}
                    >
                      <Sparkles className="h-3 w-3 mr-1 shrink-0" />
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Default welcome screen */}
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md">
              <Image src="/nexary-logo.webp" alt="Nexary" width={48} height={48} className="h-12 w-12" />
            </div>
            <h2 className="mb-2 text-2xl font-semibold text-foreground">
              {t('nexarySmart') || 'Nexary Smart'}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {t('startConversation') || 'Start a conversation'}
            </p>
          </>
        )}
      </div>

      {renderInputArea()}
    </>
  );

  return (
    <div className={cn('flex flex-1 flex-col overflow-hidden min-h-0', className)}>
      {hideWelcomeScreen || hasActiveConversation ? (
        <div className="flex flex-1 flex-col min-h-0">
          {/* Messages area will be rendered by ChatMessages component */}
          {renderInputArea()}
        </div>
      ) : (
        renderWelcomeScreen()
      )}
    </div>
  );
}

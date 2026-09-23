'use client';

/**
 * Chat Header Component
 *
 * Unified header for the chat interface that includes:
 * - Mobile menu toggle
 * - Conversation title/editing
 * - Model selector
 * - Context switcher (chat <-> dashboard)
 * - Export actions
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, Download, FileText, FileJson, Printer, Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatModelSelector } from '@/components/chat/model-selector';
import { ContextSwitcher } from '@/components/navigation/context-switcher';
import type { AIProvider } from '@/lib/ai-providers';
import {
  downloadConversationAsMarkdown,
  downloadConversationAsJSON,
  printConversationAsPDF,
} from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type Conversation = {
  id: string;
  slug: string;
  title: string;
  provider: AIProvider;
  model: string;
  useSmartSelector: boolean;
  createdAt?: string;
  updatedAt?: string;
};

interface ChatHeaderProps {
  /** Team slug for permission checking */
  teamSlug: string;
  /** Current conversation data */
  conversation?: Conversation | null;
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
  /** Callback when mobile menu is toggled */
  onMobileMenuToggle?: () => void;
  /** Callback when conversation title is updated */
  onConversationUpdate?: (title: string) => void;
  /** Whether export functionality should be available */
  showExport?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Chat header component with conversation controls.
 *
 * @example
 * ```tsx
 * <ChatHeader
 *   teamSlug={teamSlug}
 *   conversation={activeConversation}
 *   selectedProvider={selectedProvider}
 *   selectedModel={selectedModel}
 *   useSmartSelector={useSmartSelector}
 *   onProviderChange={setSelectedProvider}
 *   onModelChange={setSelectedModel}
 *   onSmartSelectorChange={setUseSmartSelector}
 *   onMobileMenuToggle={() => setMobileSidebarOpen(true)}
 *   showExport={!!activeConversation}
 * />
 * ```
 */
export function ChatHeader({
  teamSlug,
  conversation,
  selectedProvider,
  selectedModel,
  useSmartSelector,
  onProviderChange,
  onModelChange,
  onSmartSelectorChange,
  onMobileMenuToggle,
  onConversationUpdate,
  showExport = true,
  className,
}: ChatHeaderProps) {
  const t = useTranslations('chat');
  const { toast } = useToast();

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation?.title || '');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

  const handleStartEditingTitle = useCallback(() => {
    setEditedTitle(conversation?.title || '');
    setIsEditingTitle(true);
  }, [conversation?.title]);

  const handleCancelEditingTitle = useCallback(() => {
    setEditedTitle(conversation?.title || '');
    setIsEditingTitle(false);
  }, [conversation?.title]);

  const handleSaveTitle = useCallback(async () => {
    if (!editedTitle.trim() || !conversation?.id || isUpdatingTitle) {
      return;
    }

    setIsUpdatingTitle(true);
    try {
      const response = await fetch(`/api/chat/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation title');
      }

      onConversationUpdate?.(editedTitle.trim());
      setIsEditingTitle(false);

      toast({
        title: t('titleUpdated') || 'Title updated',
        description: t('titleUpdatedDesc') || 'The conversation title has been updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      toast({
        title: t('titleUpdateFailed') || 'Failed to update title',
        description: t('titleUpdateFailedDesc') || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingTitle(false);
    }
  }, [editedTitle, conversation?.id, isUpdatingTitle, onConversationUpdate, toast, t]);

  const handleExportConversation = useCallback(
    async (format: 'md' | 'json' | 'pdf') => {
      if (!conversation?.id) return;

      try {
        // Fetch conversation messages first
        const response = await fetch(`/api/chat/conversations/${conversation.id}?includeMessages=true`);
        if (!response.ok) {
          throw new Error('Failed to fetch conversation for export');
        }

        const data = await response.json();

        // Format for export
        const exportConversation = {
          title: data.title || conversation.title,
          messages: data.messages || [],
          createdAt: data.createdAt || conversation.createdAt || new Date().toISOString(),
        };

        switch (format) {
          case 'md':
            await downloadConversationAsMarkdown(exportConversation);
            break;
          case 'json':
            await downloadConversationAsJSON(exportConversation);
            break;
          case 'pdf':
            await printConversationAsPDF(exportConversation);
            break;
        }
      } catch (error) {
        console.error('Failed to export conversation:', error);
        toast({
          title: t('exportFailed') || 'Export failed',
          description: t('exportFailedDesc') || 'Please try again later.',
          variant: 'destructive',
        });
      }
    },
    [conversation, toast, t]
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      {/* Left side: Menu button + Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile menu toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onMobileMenuToggle}
          aria-label={t('openMenu') || 'Open menu'}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Conversation title */}
        {conversation ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 w-full max-w-md">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEditingTitle();
                  }}
                  className="h-8 text-sm"
                  autoFocus
                  disabled={isUpdatingTitle}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleSaveTitle}
                  disabled={isUpdatingTitle || !editedTitle.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCancelEditingTitle}
                  disabled={isUpdatingTitle}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm font-medium truncate">{conversation.title}</h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleStartEditingTitle}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <h1 className="text-sm font-medium">{t('newChat') || 'New Chat'}</h1>
        )}
      </div>

      {/* Right side: Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Model selector */}
        <ChatModelSelector
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          useSmartSelector={useSmartSelector}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          onSmartSelectorChange={onSmartSelectorChange}
        />

        {/* Context switcher */}
        <ContextSwitcher teamSlug={teamSlug} variant="ghost" size="icon" />

        {/* Export menu */}
        {showExport && conversation && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t('export') || 'Export'}
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportConversation('md')}>
                <FileText className="mr-2 h-4 w-4" />
                {t('exportMarkdown') || 'Export as Markdown'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportConversation('json')}>
                <FileJson className="mr-2 h-4 w-4" />
                {t('exportJSON') || 'Export as JSON'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportConversation('pdf')}>
                <Printer className="mr-2 h-4 w-4" />
                {t('exportPDF') || 'Print as PDF'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

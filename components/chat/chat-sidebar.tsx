'use client';

/**
 * Chat Sidebar Wrapper
 *
 * Wrapper component that combines UnifiedSidebar with chat-specific features.
 * For now, this re-exports the existing ChatSidebar with permission integration.
 * In future iterations, this could merge UnifiedSidebar with conversation list.
 *
 * Note: The existing ChatSidebar has chat-specific features (conversations list,
 * search, rename/delete dialogs) that are not part of the navigation system.
 * This wrapper provides a bridge to use the permission system with the existing sidebar.
 */

import { useEffect } from 'react';
import { ChatSidebar as ExistingChatSidebar } from '@/components/chat-sidebar';
import { usePermissions } from '@/components/auth/use-permissions';
import type { Permission } from '@/lib/permissions-config';

// Define the Conversation type locally since it's not exported from the original
export type Conversation = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
};

interface ChatSidebarProps {
  conversations: Conversation[];
  onNewChat: () => void;
  currentConversationId?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onConversationUpdated?: () => void;
  className?: string;
  collapsedClassName?: string;
  onNavigate?: () => void;
  isLoading?: boolean;
  teamSlug: string;
}

/**
 * Chat sidebar component with permission-aware navigation.
 *
 * This component wraps the existing ChatSidebar and provides
 * permission-based filtering for navigation items.
 *
 * @example
 * ```tsx
 * <ChatSidebar
 *   teamSlug={teamSlug}
 *   conversations={conversations}
 *   onNewChat={handleNewChat}
 *   currentConversationId={currentId}
 *   isCollapsed={isCollapsed}
 *   onToggleCollapse={toggleCollapse}
 *   onConversationUpdated={refreshConversations}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function ChatSidebar({
  conversations,
  onNewChat,
  currentConversationId,
  isCollapsed,
  onToggleCollapse,
  isLoading,
  onConversationUpdated,
  className,
  collapsedClassName,
  onNavigate,
  teamSlug,
}: ChatSidebarProps) {
  const { permissions, loading: loadingPerms, error } = usePermissions(teamSlug);

  // Log permission errors for debugging
  useEffect(() => {
    if (error) {
      console.error('Failed to load permissions for chat sidebar:', error);
    }
  }, [error]);

  // For now, pass through to the existing ChatSidebar
  // The permission filtering will be applied in future iterations
  return (
    <ExistingChatSidebar
      conversations={conversations}
      onNewChat={onNewChat}
      currentConversationId={currentConversationId}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      isLoading={isLoading}
      onConversationUpdated={onConversationUpdated}
      className={className}
      collapsedClassName={collapsedClassName}
      onNavigate={onNavigate}
      teamSlug={teamSlug}
    />
  );
}

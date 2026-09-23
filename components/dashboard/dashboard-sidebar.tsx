'use client';

/**
 * Dashboard Sidebar Wrapper
 *
 * Uses ChatSidebar for unified styling across chat and dashboard.
 * ChatSidebar now has permission-based navigation built in.
 */

import { memo } from 'react';
import { ChatSidebar as OriginalChatSidebar } from '@/components/chat-sidebar';
import type { Conversation } from '@/components/chat/chat-sidebar';

interface DashboardSidebarProps {
  teamSlug: string;
  className?: string;
  collapsedClassName?: string;
  onNavigate?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Dashboard sidebar component using the unified ChatSidebar.
 *
 * This provides a consistent user experience across chat and dashboard,
 * with permission-based navigation already integrated into ChatSidebar.
 *
 * @example
 * ```tsx
 * <DashboardSidebar
 *   teamSlug={teamSlug}
 *   onNavigate={() => setSidebarOpen(false)}
 *   showCloseButton
 * />
 * ```
 */
const DashboardSidebarComponent = ({
  teamSlug,
  className,
  collapsedClassName,
  onNavigate,
  showCloseButton,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: DashboardSidebarProps) => {
  // ChatSidebar expects conversations array, but dashboard doesn't have conversations
  // We pass an empty array and it will just show navigation items
  const conversations: Conversation[] = [];

  return (
    <OriginalChatSidebar
      conversations={conversations}
      onNewChat={() => {
        // In dashboard context, clicking "New Chat" could go to /chat
        // or we could disable this button
        window.location.href = '/chat';
      }}
      currentConversationId={undefined}
      isCollapsed={isCollapsed}
      onToggleCollapse={() => {
        onToggleCollapse?.();
      }}
      isLoading={false}
      className={className}
      collapsedClassName={collapsedClassName}
      onNavigate={onNavigate}
      teamSlug={teamSlug}
      hideChatFeatures={true}
      showCloseButton={showCloseButton}
      onClose={onClose}
    />
  );
};

export const DashboardSidebar = memo(DashboardSidebarComponent);

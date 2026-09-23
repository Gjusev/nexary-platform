'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Plus,
  Search,
  ChevronDown,
  User,
  LogOut,
  BookOpen,
  Database,
  Menu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@stackframe/stack';
import { useTeam } from '@/hooks/use-team';

type Conversation = {
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
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export function ChatSidebar({ conversations, onNewChat, currentConversationId, isCollapsed, onToggleCollapse }: ChatSidebarProps) {
  const pathname = usePathname();
  const user = useUser({ or: 'redirect' });
  const { teamName, teamSlug, isOwner, roles } = useTeam();
  const [searchQuery, setSearchQuery] = useState('');

  const displayName = user.displayName || user.primaryEmail || 'Usuario';
  const email = user.primaryEmail || 'sin-email';
  const initials = getInitials(user.displayName, user.primaryEmail);

  const hasAdminAccess = isOwner || roles.includes('TEAM_LEADER');

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSignOut = async () => {
    await user.signOut();
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-16">
        {/* Toggle Button */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-full"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Collapsed Icons */}
        <div className="flex-1 p-3 space-y-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewChat}
            className="w-full"
            title="Neuer Chat"
          >
            <Plus className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Prompt-Bibliothek"
          >
            <Link href="/dashboard/prompts">
              <BookOpen className="w-5 h-5" />
            </Link>
          </Button>

          {hasAdminAccess && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Assistenten"
            >
              <Link href="/dashboard/rag">
                <Database className="w-5 h-5" />
              </Link>
            </Button>
          )}
        </div>

        {/* User Avatar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/profile">
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Top Section - Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">T1</span>
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              {teamName || teamSlug || 'T1'}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="p-3 space-y-1">
        <Button
          onClick={onNewChat}
          variant="ghost"
          className="w-full justify-start gap-3 h-10"
        >
          <Plus className="w-5 h-5" />
          <span>Neuer Chat</span>
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10"
          asChild
        >
          <Link href="/chat">
            <Search className="w-5 h-5" />
            <span>Chats suchen</span>
          </Link>
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10"
          asChild
        >
          <Link href="/dashboard/prompts">
            <BookOpen className="w-5 h-5" />
            <span>Prompt-Bibliothek</span>
          </Link>
        </Button>

        {hasAdminAccess && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-10"
            asChild
          >
            <Link href="/dashboard/rag">
              <Database className="w-5 h-5" />
              <span>Assistenten</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-hidden">
        {conversations.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Heute</p>
          </div>
        )}
        <ScrollArea className="h-full px-3">
          <div className="space-y-1 pb-4">
            {conversations.length === 0 ? (
              <div className="text-center py-8 px-4 text-sm text-slate-500 dark:text-slate-400">
                Deine Unterhaltungen werden hier angezeigt
              </div>
            ) : (
              conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.slug}`}
                  className={`
                    block px-3 py-2 rounded-lg transition-colors text-sm
                    ${currentConversationId === conv.id || pathname === `/chat/${conv.slug}`
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  `}
                >
                  <span className="truncate block">{conv.title}</span>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Section - User Menu */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2 px-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {teamName || teamSlug}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/profile">
                <User className="w-4 h-4 mr-2" />
                Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

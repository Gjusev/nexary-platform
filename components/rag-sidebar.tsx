'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Plus, 
  Search, 
  Library,
  Database,
  User,
  LogOut,
  Menu,
  X,
  MessageSquare,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@stackframe/stack';

type RagPackage = {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  totalChunks: number;
  createdAt: string;
};

interface RagSidebarProps {
  ragPackages: RagPackage[];
  onNewRag: () => void;
  currentRagId?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function RagSidebar({ 
  ragPackages, 
  onNewRag, 
  currentRagId,
  isCollapsed,
  onToggleCollapse 
}: RagSidebarProps) {
  const router = useRouter();
  const user = useUser();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPackages = ragPackages.filter(pkg =>
    pkg.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUserInitials = () => {
    if (!user) return '?';
    const displayName = user.displayName || user.primaryEmail || '';
    return displayName.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await user?.signOut();
    router.push('/login');
  };

  if (isCollapsed) {
    return (
      <div className="h-full w-16 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center justify-center border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-10 h-10 text-sidebar-primary hover:text-sidebar-primary/80"
            title="Menü erweitern"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Icons */}
        <div className="flex-1 flex flex-col items-center gap-2 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewRag}
            className="w-10 h-10"
            title="Neues RAG Paket"
          >
            <Plus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10"
            title="Suchen"
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/chat')}
            className="w-10 h-10"
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/prompts')}
            className="w-10 h-10"
            title="Prompt-Bibliothek"
          >
            <Library className="w-5 h-5" />
          </Button>
        </div>

        {/* User */}
        <div className="p-2 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.displayName || 'Benutzer'}</p>
                <p className="text-xs text-muted-foreground">{user?.primaryEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')}>
                <User className="w-4 h-4 mr-2" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
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
    <div className="h-full w-80 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Image
            src="/nexary-logo-long.svg"
            alt="Nexary"
            width={152}
            height={32}
            className="h-8 w-auto dark:invert"
          />
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline-block">
            Nexary
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="w-8 h-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* New RAG Button */}
      <div className="p-3">
        <Button
          onClick={onNewRag}
          className="w-full justify-start bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neues RAG Paket
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="RAG Pakete suchen..."
            className="pl-9 bg-muted border-border"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 pb-2 space-y-1">
        <Button
          variant="ghost"
          onClick={() => router.push('/chat')}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Chat
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/prompts')}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Library className="w-4 h-4 mr-2" />
          Prompt-Bibliothek
        </Button>
      </div>

      {/* RAG Packages List */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 pb-4">
          {filteredPackages.length > 0 && (
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground px-2 py-1">
                Meine RAG Pakete
              </h3>
            </div>
          )}
          {filteredPackages.map((pkg) => (
            <Button
              key={pkg.id}
              variant={pkg.id === currentRagId ? 'secondary' : 'ghost'}
              onClick={() => router.push(`/dashboard/rag/${pkg.id}`)}
              className="w-full justify-start text-sm font-normal h-auto py-2 px-2 flex-col items-start"
            >
              <div className="flex items-center gap-2 w-full">
                <Database className="w-4 h-4 flex-shrink-0" />
                <span className="truncate font-medium">{pkg.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                <FileText className="w-3 h-3" />
                <span>{pkg.documentCount} Dokumente</span>
              </div>
            </Button>
          ))}
          {filteredPackages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Keine RAG Pakete gefunden' : 'Keine RAG Pakete vorhanden'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* User Dropdown */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-2 h-12"
            >
              <Avatar className="w-8 h-8 mr-2">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-sidebar-foreground">
                  {user?.displayName || 'Benutzer'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.primaryEmail}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')}>
              <User className="w-4 h-4 mr-2" />
              Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

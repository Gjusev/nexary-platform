"use client";
import { useState, useEffect, memo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  MessageSquarePlus,
  Search,
  Library,
  Sparkles,
  User,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Database,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useUser } from "@stackframe/stack";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ConversationsListSkeleton } from "./chat-skeleton";
import { usePermissions } from "@/components/auth/use-permissions";
import { PERMISSIONS } from "@/lib/permissions-config";

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
  onConversationUpdated?: () => void;
  className?: string;
  collapsedClassName?: string;
  onNavigate?: () => void;
  isLoading?: boolean;
  teamSlug: string;
  /** Hide chat-specific features (New Chat button, conversations list, search) */
  hideChatFeatures?: boolean;
  /** Show close button instead of collapse button */
  showCloseButton?: boolean;
  /** Callback when close button is clicked */
  onClose?: () => void;
}

const ChatSidebarComponent = ({
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
  hideChatFeatures = false,
  showCloseButton = false,
  onClose,
}: ChatSidebarProps) => {
  const router = useRouter();
  const user = useUser();
  const { toast } = useToast();
  const t = useTranslations("sidebar");
  const { permissions, hasPermission } = usePermissions(teamSlug);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      let chatTitle = "Chat";
      if (currentConversationId) {
        const activeConv = conversations.find(
          (c: Conversation) => c.id === currentConversationId
        );
        if (activeConv && activeConv.title) {
          chatTitle = activeConv.title;
        }
      }
      document.title = `${chatTitle}`;
      // Favicon update
      const faviconUrl = "/nexary-logo.webp";
      let favicon =
        document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = faviconUrl;
    }
  }, [currentConversationId, conversations]);

  const handleDeleteClick = (
    conversation: Conversation,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setSelectedConversation(conversation);
    setDeleteDialogOpen(true);
  };

  const handleRenameClick = (
    conversation: Conversation,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setSelectedConversation(conversation);
    setNewTitle(conversation.title);
    setRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!selectedConversation || !newTitle.trim()) return;

    setIsRenaming(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${selectedConversation.slug}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle.trim() }),
        }
      );

      if (!res.ok) throw new Error("Failed to rename conversation");

      toast({
        title: t("renamed"),
        description: t("renameSuccess"),
      });

      setRenameDialogOpen(false);
      onConversationUpdated?.();
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast({
        title: t("error"),
        description: t("renameError"),
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConversation) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${selectedConversation.slug}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Failed to delete conversation");

      toast({
        title: t("deleted"),
        description: t("deleteSuccess"),
      });

      setDeleteDialogOpen(false);

      // If deleting current conversation, redirect to /chat
      if (selectedConversation.id === currentConversationId) {
        router.push("/chat");
      }

      onConversationUpdated?.();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: t("error"),
        description: t("deleteError"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getUserInitials = () => {
    if (!user) return "?";
    const displayName = user.displayName || user.primaryEmail || "";
    return displayName.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await user?.signOut();
    router.push("/login");
  };

  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex h-dvh w-16 flex-col border-r",
          collapsedClassName
        )}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {/* Header */}
        <div
          className="h-16 flex items-center justify-center border-b"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-10 h-10"
            style={{ color: "var(--sidebar-primary)" }}
            title={t("expandMenu")}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Icons */}
        <div className="flex-1 flex flex-col items-center gap-2 py-4">
          {!hideChatFeatures && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onNewChat();
                  onNavigate?.();
                }}
                className="w-10 h-10"
                style={{
                  background: "var(--sidebar-primary)",
                  color: "var(--sidebar-primary-foreground)",
                }}
                title={t("newChat")}
              >
                <MessageSquarePlus className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10"
                title={t("search")}
              >
                <Search className="w-5 h-5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              router.push("/dashboard/prompts");
              onNavigate?.();
            }}
            className="w-10 h-10"
            title={t("promptLibrary")}
          >
            <Library className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              router.push("/dashboard/assistants");
              onNavigate?.();
            }}
            className="w-10 h-10"
            title={t("assistants")}
          >
            <Sparkles className="w-5 h-5" />
          </Button>
          {hasPermission(PERMISSIONS.RAG_QUERY) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                router.push("/dashboard/rag");
                onNavigate?.();
              }}
              className="w-10 h-10"
              title={t("ragPackages")}
            >
              <Database className="w-5 h-5" />
            </Button>
          )}
          {hasPermission(PERMISSIONS.RAG_INGEST) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                router.push("/dashboard/documents");
                onNavigate?.();
              }}
              className="w-10 h-10"
              title={t("documents")}
            >
              <FileText className="w-5 h-5" />
            </Button>
          )}
          {hasPermission(PERMISSIONS.TEAM_VIEW) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                router.push("/dashboard/analytics");
                onNavigate?.();
              }}
              className="w-10 h-10"
              title={t("analytics")}
            >
              <BarChart3 className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* User */}
        <div
          className="p-2 border-t"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">
                  {user?.displayName || t("user")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.primaryEmail}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/settings/profile")}
              >
                <User className="w-4 h-4 mr-2" />
                {t("profile")}
              </DropdownMenuItem>
              {hasPermission(PERMISSIONS.TEAM_VIEW) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/team")}
                  >
                    <User className="w-4 h-4 mr-2" />
                    {t("team")}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Filter conversations based on searchQuery
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={cn(
        "grid h-dvh border-r border-sidebar-border bg-gradient-to-br from-teal-50/30 via-background to-background dark:from-teal-950/20 dark:via-background dark:to-background transition-all duration-300",
        isCollapsed ? "w-16 grid-rows-[auto_1fr_auto]" : "w-72 grid-rows-[auto_1fr_auto]",
        className
      )}
    >
      {/* Header */}
      <div className={`h-16 flex items-center border-b border-sidebar-border ${isCollapsed ? 'justify-center px-2' : 'justify-between px-6'}`}>
        {!isCollapsed && (
          <div className="flex items-center">
            <Image
              src="/nexary-logo-long.webp"
              alt="Nexary"
              width={152}
              height={32}
              className="h-8 w-auto dark:invert"
            />
          </div>
        )}
        <div className={isCollapsed ? '' : 'ml-auto'}>
          {showCloseButton ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onClose?.();
                onNavigate?.();
              }}
              className="w-8 h-8"
              title={t("closeMenu")}
            >
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onToggleCollapse();
              }}
              className="w-8 h-8"
              title={isCollapsed ? t("expandMenu") : t("collapseMenu")}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Content Area - Second grid row (1fr) */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        {/* Expanded View */}
        {!isCollapsed && (
          <>
            {/* New Chat Button or Back to Chat Button */}
            <div className="p-3 shrink-0">
              {hideChatFeatures ? (
                <Button
                  onClick={() => {
                    router.push('/chat');
                    onNavigate?.();
                  }}
                  className="w-full justify-start bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
                >
                  <MessageSquarePlus className="w-4 h-4 mr-2" />
                  {t("backToChat")}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    onNewChat();
                    onNavigate?.();
                  }}
                  className="w-full justify-start bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
                >
                  <MessageSquarePlus className="w-4 h-4 mr-2" />
                  {t("newChat")}
                </Button>
              )}
            </div>

            {/* Search */}
            {!hideChatFeatures && (
              <div className="px-3 pb-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchChats")}
                    className="pl-9 bg-input border-border"
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="px-3 pb-2 space-y-1 shrink-0">
              <Button
                variant="ghost"
                onClick={() => {
                  router.push("/dashboard/prompts");
                  onNavigate?.();
                }}
                className="w-full justify-start text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
              >
                <Library className="w-4 h-4 mr-2" />
                {t("promptLibrary")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  router.push("/dashboard/assistants");
                  onNavigate?.();
                }}
                className="w-full justify-start text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {t("assistants")}
              </Button>
              {hasPermission(PERMISSIONS.RAG_QUERY) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    router.push("/dashboard/rag");
                    onNavigate?.();
                  }}
                  className="w-full justify-start text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                >
                  <Database className="w-4 h-4 mr-2" />
                  {t("ragPackages")}
                </Button>
              )}
              {hasPermission(PERMISSIONS.RAG_INGEST) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    router.push("/dashboard/documents");
                    onNavigate?.();
                  }}
                  className="w-full justify-start text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {t("documents")}
                </Button>
              )}
              {hasPermission(PERMISSIONS.TEAM_VIEW) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    router.push("/dashboard/analytics");
                    onNavigate?.();
                  }}
                  className="w-full justify-start text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {t("analytics")}
                </Button>
              )}
            </div>

            {/* Content Area - Conversations (chat mode) or spacer (dashboard mode) */}
            <div className="flex-1 min-h-0 flex flex-col">
              {!hideChatFeatures ? (
                <ScrollArea className="flex-1 min-h-0 px-3">
                  {isLoading ? (
                    <ConversationsListSkeleton count={10} />
                  ) : (
                    <div className="space-y-1 pb-4">
                      {filteredConversations.length > 0 && (
                        <div className="mb-2">
                          <h3 className="text-xs font-semibold text-muted-foreground px-2 py-1">
                            {t("today")}
                          </h3>
                        </div>
                      )}
                      {filteredConversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className="group relative flex items-center"
                        >
                          <Button
                            variant={
                              conversation.id === currentConversationId
                                ? "secondary"
                                : "ghost"
                            }
                            onClick={() => {
                              router.push(`/chat/${conversation.slug}`);
                              onNavigate?.();
                            }}
                            className={cn(
                              "flex-1 min-w-0 justify-start text-sm font-normal h-9 px-2 relative transition-[width]",
                              conversation.id === currentConversationId && "bg-primary/15 hover:bg-primary/20 border-l-2 border-l-primary font-medium"
                            )}
                          >
                            <span className="truncate max-w-[200px] text-left">
                              {conversation.title}
                            </span>
                          </Button>
                          {/* Menu de opciones */}
                          <div className="w-0 opacity-0 group-hover:w-7 group-hover:opacity-100 transition-all duration-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-sidebar-accent" // Added background to ensure visibility if needed, but hover handles it.
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={(e) => handleRenameClick(conversation, e)}
                                >
                                  <Pencil className="w-4 h-4 mr-2" />
                                  {t("rename")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => handleDeleteClick(conversation, e)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                      {filteredConversations.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">
                            {searchQuery ? t("noChatsFound") : t("noChats")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          </>
        )}

        {/* Collapsed View - Icon Navigation */}
        {isCollapsed && (
          <div className="flex-1 flex flex-col items-center gap-2 py-4">
            {hideChatFeatures ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    router.push('/chat');
                    onNavigate?.();
                  }}
                  className="w-10 h-10"
                  title={t("backToChat")}
                >
                  <MessageSquarePlus className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    router.push("/dashboard/prompts");
                    onNavigate?.();
                  }}
                  className="w-10 h-10"
                  title={t("promptLibrary")}
                >
                  <Library className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    router.push("/dashboard/assistants");
                    onNavigate?.();
                  }}
                  className="w-10 h-10"
                  title={t("assistants")}
                >
                  <Sparkles className="w-5 h-5" />
                </Button>
                {hasPermission(PERMISSIONS.RAG_QUERY) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      router.push("/dashboard/rag");
                      onNavigate?.();
                    }}
                    className="w-10 h-10"
                    title={t("ragPackages")}
                  >
                    <Database className="w-5 h-5" />
                  </Button>
                )}
                {hasPermission(PERMISSIONS.RAG_INGEST) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      router.push("/dashboard/documents");
                      onNavigate?.();
                    }}
                    className="w-10 h-10"
                    title={t("documents")}
                  >
                    <FileText className="w-5 h-5" />
                  </Button>
                )}
                {hasPermission(PERMISSIONS.TEAM_VIEW) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      router.push("/dashboard/analytics");
                      onNavigate?.();
                    }}
                    className="w-10 h-10"
                    title={t("analytics")}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </Button>
                )}
                {hasPermission(PERMISSIONS.TEAM_VIEW) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      router.push("/dashboard/team");
                      onNavigate?.();
                    }}
                    className="w-10 h-10"
                    title={t("team")}
                  >
                    <User className="w-5 h-5" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onNewChat();
                    onNavigate?.();
                  }}
                  className="w-10 h-10"
                  title={t("newChat")}
                >
                  <MessageSquarePlus className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10"
                  title={t("search")}
                >
                  <Search className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* User Dropdown - Always at bottom */}
      <div className={`border-t border-sidebar-border shrink-0 ${isCollapsed ? 'p-2' : 'p-3'}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`w-full ${isCollapsed ? 'justify-center px-0 h-10' : 'justify-start px-2 h-12'}`}>
              <Avatar className={`${isCollapsed ? 'h-8 w-8' : 'w-8 h-8 mr-2'}`}>
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground">
                    {user?.displayName || t("user")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.primaryEmail}
                  </p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings/profile")}
            >
              <User className="w-4 h-4 mr-2" />
              {t("profile")}
            </DropdownMenuItem>
            {hasPermission(PERMISSIONS.TEAM_VIEW) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/team")}
                >
                  <User className="w-4 h-4 mr-2" />
                  {t("team")}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameConversation")}</DialogTitle>
            <DialogDescription>{t("enterNewName")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="title" className="text-sm font-medium">
              {t("titleLabel")}
            </Label>
            <Input
              id="title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("newTitlePlaceholder")}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newTitle.trim() || isRenaming}
            >
              {isRenaming ? t("renaming") : t("rename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConversation")}</DialogTitle>
            <DialogDescription>{t("deleteWarning")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

// Memoize component to prevent unnecessary re-renders
export const ChatSidebar = memo(ChatSidebarComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.currentConversationId === nextProps.currentConversationId &&
    prevProps.isCollapsed === nextProps.isCollapsed &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.conversations.length === nextProps.conversations.length &&
    JSON.stringify(prevProps.conversations) === JSON.stringify(nextProps.conversations)
  );
});

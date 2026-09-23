'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useTeam } from '@/hooks/use-team';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useChatMessagesContext,
  useChatStreamingContext,
  useChatNavigationContext,
} from '@/components/chat/providers';
import {
  Loader2,
  Mic,
  ArrowUp,
  Database,
  Plus,
  Menu,
  ThumbsUp,
  ThumbsDown,
  Square,
  Pin,
  Download,
  FileText,
  FileJson,
  Printer,
  ChevronDown,
  BookOpen,
  Sparkles,
  Globe,
  ExternalLink,
  ArrowDown,
  Search,
} from 'lucide-react';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { Badge } from '@/components/ui/badge';
import { ChatRagSlider, type RagPackage } from '@/components/chat-rag-slider';
import { RagVisualization } from '@/components/rag/rag-visualization';
import { AdvancedSearch, type SearchFilters } from '@/components/search/advanced-search';
import { EnhancedCitations, InlineCitation } from '@/components/search/enhanced-citations';
import type { AIProvider } from '@/lib/ai-providers';
import { ChatModelSelector } from '@/components/chat/model-selector';
import { ReportLoader } from '@/components/chat/report-loader';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';
import { ThinkingIndicator } from '@/components/chat/thinking-indicator';
import { ReasoningDisplay } from '@/components/chat/reasoning-display';
import { ExcelViewer } from '@/components/data/excel-viewer';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';
import { ChatMessagesAreaSkeleton, ConversationsListSkeleton } from '@/components/chat-skeleton';
import { CodeBlock } from '@/components/code-block';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  downloadConversationAsMarkdown,
  downloadConversationAsJSON,
  printConversationAsPDF,
  downloadReportAsPDF,
} from '@/lib/export-utils';
import { ReportCard } from '@/components/chat/report-card';
import { ReportViewerDialog } from '@/components/chat/report-viewer-dialog';
import { type Protocol } from '@/types/protocol';
import { ClipboardList } from 'lucide-react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, any>;
};

type Conversation = {
  id: string;
  slug: string;
  title: string;
  ragPackageIds: string[];
  provider: AIProvider;
  model: string;
  useSmartSelector: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
  hasMoreMessages?: boolean;
};

const MESSAGES_PAGE_SIZE = 10;

export default function ChatLayout() {
  const t = useTranslations('chat');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params?.conversationId as string | undefined;
  const assistantId = searchParams.get('assistant');


  //const locale = useLocale();
  //console.log('Current locale in chat:', locale);
  console.log('Translation function t:', t);
  console.log('Translated placeholder:', t('howCanWeHelp'));
  console.log('Translated title:', t('nexarySmart'));
  const { session, teamSlug } = useTeam();
  const { toast } = useToast();

  // Initialize context hooks (gradual integration)
  // These provide the business logic functions from our hooks
  const messagesContext = useChatMessagesContext();
  const streamingContext = useChatStreamingContext();
  const navigationContext = useChatNavigationContext();

  // State (keeping local state for now, will gradually migrate)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingActiveConversation, setLoadingActiveConversation] = useState(false);
  const [ragPackages, setRagPackages] = useState<RagPackage[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showRagSelector, setShowRagSelector] = useState(false);
  const [showRagSlider, setShowRagSlider] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  // New enhancement states
  const [abortControllerRef] = useState<{ current: AbortController | null }>({ current: null });
  const [messageSources, setMessageSources] = useState<Record<string, any[]>>({});
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'up' | 'down'>>({});

  // Thinking indicator states
  const [thinkingState, setThinkingState] = useState<'idle' | 'thinking' | 'reasoning' | 'streaming'>('idle');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [modelInfo, setModelInfo] = useState<{ provider: AIProvider; model: string; modelName: string; hasReasoning: boolean } | null>(null);
  const [messageReasoning, setMessageReasoning] = useState<Record<string, string>>({});
  const [messageModelInfo, setMessageModelInfo] = useState<Record<string, { provider: AIProvider; model: string; modelName: string }>>({});

  // Helper to safely parse report JSON
  const tryParseReport = (content: string): Protocol | null => {
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
  };

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearchSources, setWebSearchSources] = useState<Record<string, any[]>>({});

  // Excel data state - stores workbook data for uploaded Excel files
  const [uploadedExcelData, setUploadedExcelData] = useState<Record<string, { filename: string; workbook: any }>>({});

  // Assistant state
  const [loadedAssistant, setLoadedAssistant] = useState<any | null>(null);

  // Model configuration state
  const user = useUser();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [useSmartSelector, setUseSmartSelector] = useState(false);

  // Report/Protocol Mode State
  const [isReportMode, setIsReportMode] = useState(false);
  const [viewingReport, setViewingReport] = useState<Protocol | null>(null);
  const [isReportViewerOpen, setIsReportViewerOpen] = useState(false);

  // Advanced Search State
  const [isAdvancedSearchMode, setIsAdvancedSearchMode] = useState(false);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<any[]>([]);
  const [showAdvancedSearchPanel, setShowAdvancedSearchPanel] = useState(false);

  // Enhanced Citations State
  const [useEnhancedCitations, setUseEnhancedCitations] = useState(true);

  // Smooth transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'enter' | 'exit'>('enter');

  // Initialize with user preferences if available
  useEffect(() => {
    if (!activeConversation && user?.clientMetadata) {
      const metadata = user.clientMetadata as Record<string, any>;
      const prefs = metadata?.preferences;

      if (prefs.defaultProvider) {
        setSelectedProvider(prefs.defaultProvider as AIProvider);
      }

      if (prefs.defaultModel) {
        setSelectedModel(prefs.defaultModel);
      }
    }
  }, [user, activeConversation]);
  // Wait, if I change manually, selectedProvider changes. React re-render.
  // The Effect only runs if `user` object changes content... which is rare/initial load.
  // BUT `activeConversation` changes when we start chat.

  // Refined Logic below in ReplacementContent


  // Scroll state
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const isScrolledUpRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isScrolledUpRef.current = isScrolledUp;
  }, [isScrolledUp]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const loadingOlderMessagesRef = useRef(false);
  const originalOverflowRef = useRef<string | null>(null);
  const activeConversationId = activeConversation?.id;
  const activeConversationMessageCount = activeConversation?.messages?.length ?? 0;

  const getViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  }, [getViewport]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const timeout = setTimeout(() => {
      scrollToBottom('auto');
    }, 0);

    return () => clearTimeout(timeout);
  }, [activeConversationId, scrollToBottom]);

  // Smart auto-scroll: only scroll if user is at the bottom
  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    if (loadingOlderMessagesRef.current) {
      return;
    }

    // Only auto-scroll if user is NOT scrolled up (reading old messages)
    if (!isScrolledUp) {
      scrollToBottom('smooth');
    }
  }, [activeConversationId, activeConversationMessageCount, scrollToBottom, isScrolledUp]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const shouldLockScroll = mobileSidebarOpen || (showRagSlider && isMobileViewport);

    if (shouldLockScroll) {
      if (originalOverflowRef.current === null) {
        originalOverflowRef.current = document.body.style.overflow;
      }
      document.body.style.overflow = 'hidden';
    } else if (originalOverflowRef.current !== null) {
      document.body.style.overflow = originalOverflowRef.current;
      originalOverflowRef.current = null;
    }
  }, [mobileSidebarOpen, showRagSlider, isMobileViewport]);

  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') {
        return;
      }

      if (originalOverflowRef.current !== null) {
        document.body.style.overflow = originalOverflowRef.current;
        originalOverflowRef.current = null;
      }
    };
  }, []);

  // Scroll detection for scroll-to-bottom button
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Show button if scrolled up more than 200px from bottom
      setIsScrolledUp(distanceFromBottom > 200);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [getViewport, activeConversation]);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || loadingOlderMessagesRef.current) {
      return;
    }

    if (!activeConversation.hasMoreMessages) {
      return;
    }

    if (!activeConversation.messages || activeConversation.messages.length === 0) {
      return;
    }

    const oldestMessage = activeConversation.messages[0];
    if (!oldestMessage) {
      return;
    }

    const viewport = getViewport();
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    const previousScrollTop = viewport?.scrollTop ?? 0;

    setLoadingOlderMessages(true);
    loadingOlderMessagesRef.current = true;

    let didSucceed = false;

    try {
      const conversationIdentifier = conversationId || activeConversation.slug;
      if (!conversationIdentifier) {
        throw new Error('No conversation identifier');
      }

      const params = new URLSearchParams({
        limit: String(MESSAGES_PAGE_SIZE),
        before: oldestMessage.createdAt,
      });

      const response = await fetch(`/api/chat/conversations/${conversationIdentifier}/messages?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      if (data.success) {
        const fetchedMessages = (data.messages || []) as ChatMessage[];
        const hasMore = Boolean(data.hasMore);

        setActiveConversation((prev) => {
          if (!prev) return prev;

          const existingIds = new Set(prev.messages?.map((msg) => msg.id));
          const newMessages = fetchedMessages.filter((msg) => !existingIds.has(msg.id));

          if (newMessages.length === 0) {
            return { ...prev, hasMoreMessages: hasMore };
          }

          return {
            ...prev,
            messages: [...newMessages, ...(prev.messages || [])],
            hasMoreMessages: hasMore,
          };
        });

        didSucceed = true;

        requestAnimationFrame(() => {
          const viewportAfter = getViewport();
          if (viewportAfter) {
            const newScrollHeight = viewportAfter.scrollHeight;
            viewportAfter.scrollTop = Math.max(newScrollHeight - previousScrollHeight + previousScrollTop, 0);
          }

          setLoadingOlderMessages(false);
          loadingOlderMessagesRef.current = false;
        });
      } else {
        throw new Error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      if (!didSucceed) {
        setLoadingOlderMessages(false);
        loadingOlderMessagesRef.current = false;
      }
    }
  }, [activeConversation, conversationId, getViewport]);

  useEffect(() => {
    const handleScroll = () => {
      const viewportNode = getViewport();
      if (!viewportNode) {
        return;
      }

      if (viewportNode.scrollTop <= 16 && activeConversation?.hasMoreMessages && !loadingOlderMessagesRef.current) {
        loadOlderMessages();
      }
    };

    const viewportNode = getViewport();
    viewportNode?.addEventListener('scroll', handleScroll);

    return () => {
      viewportNode?.removeEventListener('scroll', handleScroll);
    };
  }, [activeConversation?.hasMoreMessages, getViewport, loadOlderMessages]);

  // Redirect if not authenticated
  // Redirect if not authenticated logic is handled by useUser hook in useTeam
  // We removed the manual router.push('/login') here to prevent infinite loops during loading

  // Load conversations and RAG packages
  const fetchConversations = async () => {
    try {
      const conversationsRes = await fetch('/api/chat/conversations');
      if (conversationsRes.ok) {
        const conversationsData = await conversationsRes.json();
        if (conversationsData.success) {
          setConversations(conversationsData.conversations);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [conversationsRes, packagesRes] = await Promise.all([
          fetch('/api/chat/conversations'),
          fetch('/api/rag/packages')
        ]);

        if (conversationsRes.ok) {
          const conversationsData = await conversationsRes.json();
          if (conversationsData.success) {
            setConversations(conversationsData.conversations);
          }
        }

        if (packagesRes.ok) {
          const packagesData = await packagesRes.json();
          if (packagesData.success) {
            setRagPackages(packagesData.packages);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingConversations(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session]);

  // Load assistant when assistantId is present
  useEffect(() => {
    const loadAssistant = async () => {
      if (!assistantId) {
        setLoadedAssistant(null);
        return;
      }

      try {
        const response = await fetch(`/api/assistants/${assistantId}`);
        if (response.ok) {
          const data = await response.json();
          // API returns { template: {...} } structure
          const assistant = data.template || data;
          if (assistant && assistant.id) {
            console.log('✅ Loaded assistant:', assistant);
            setLoadedAssistant(assistant);
            toast({
              title: `🤖 ${assistant.name}`,
              description: assistant.description || 'Asistente cargado',
              duration: 3000,
            });
          }
        } else {
          console.error('❌ Failed to load assistant, status:', response.status);
        }
      } catch (error) {
        console.error('Error loading assistant:', error);
      }
    };

    loadAssistant();
  }, [assistantId, toast]);

  // Load active conversation
  useEffect(() => {
    const fetchActiveConversation = async () => {
      if (!conversationId) {
        setActiveConversation(null);
        setLoadingActiveConversation(false);
        setLoadingOlderMessages(false);
        loadingOlderMessagesRef.current = false;
        return;
      }

      try {
        setLoadingActiveConversation(true);
        setLoadingOlderMessages(false);
        loadingOlderMessagesRef.current = false;

        const res = await fetch(`/api/chat/conversations/${conversationId}?limit=${MESSAGES_PAGE_SIZE}`);
        const data = await res.json();
        if (res.ok && data.success) {
          console.log('✅ Loaded conversation:', data.conversation);
          console.log('📊 Messages count:', data.conversation.messages?.length);
          console.log('💬 Messages:', data.conversation.messages);

          // Extract sources from message metadata for existing messages
          const sourcesFromMessages: Record<string, any[]> = {};
          const webSourcesFromMessages: Record<string, any[]> = {};
          if (data.conversation.messages) {
            for (const message of data.conversation.messages) {
              if (message.role === 'assistant' && message.metadata?.sources) {
                sourcesFromMessages[message.id] = message.metadata.sources;
              }
              if (message.role === 'assistant' && message.metadata?.webSources) {
                webSourcesFromMessages[message.id] = message.metadata.webSources;
              }
            }
          }
          if (Object.keys(sourcesFromMessages).length > 0) {
            console.log('📚 Loaded sources from message metadata:', Object.keys(sourcesFromMessages).length);
            setMessageSources(prev => ({ ...prev, ...sourcesFromMessages }));
          }
          if (Object.keys(webSourcesFromMessages).length > 0) {
            console.log('🌐 Loaded web sources from message metadata:', Object.keys(webSourcesFromMessages).length);
            setWebSearchSources(prev => ({ ...prev, ...webSourcesFromMessages }));
          }

          setActiveConversation({
            ...data.conversation,
            hasMoreMessages: data.conversation.hasMoreMessages ?? false,
          });
        } else {
          console.error('❌ Failed to load conversation:', data);
          setActiveConversation(null);
        }
      } catch (error) {
        console.error('💥 Error fetching conversation:', error);
        setActiveConversation(null);
        setLoadingOlderMessages(false);
        loadingOlderMessagesRef.current = false;
      } finally {
        setLoadingActiveConversation(false);
      }
    };

    fetchActiveConversation();
  }, [conversationId]);

  // Load assistant when activeConversation has an assistantId
  useEffect(() => {
    const loadAssistantFromConversation = async () => {
      // If we already have the assistant loaded from URL param, skip
      if (assistantId && loadedAssistant?.id === assistantId) {
        return;
      }

      // If the conversation has an assistantId, load that assistant
      const convAssistantId = (activeConversation as any)?.assistantId;
      if (convAssistantId && convAssistantId !== loadedAssistant?.id) {
        try {
          const response = await fetch(`/api/assistants/${convAssistantId}`);
          if (response.ok) {
            const data = await response.json();
            const assistant = data.template || data;
            if (assistant && assistant.id) {
              console.log('✅ Loaded assistant from conversation:', assistant.name);
              setLoadedAssistant(assistant);
            }
          }
        } catch (error) {
          console.error('Error loading assistant from conversation:', error);
        }
      }
    };

    if (activeConversation) {
      loadAssistantFromConversation();
    }
  }, [activeConversation, assistantId, loadedAssistant?.id]);

  const updateConversationRagPackages = useCallback(
    async (conversationSlug: string, ragPackageIds: string[]): Promise<string[] | null> => {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationSlug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ragPackageIds }),
        });

        if (!res.ok) throw new Error('Failed to update RAG packages');

        const data = await res.json();
        if (data.success) {
          const updatedConversation = data.conversation as Conversation | undefined;
          const updatedIds =
            updatedConversation?.ragPackageIds?.length
              ? updatedConversation.ragPackageIds
              : ragPackageIds;

          setActiveConversation((prev) => {
            if (!prev) return prev;
            if (
              updatedConversation &&
              (prev.id === updatedConversation.id || prev.slug === updatedConversation.slug)
            ) {
              return { ...prev, ragPackageIds: updatedIds };
            }
            if (prev.slug === conversationSlug) {
              return { ...prev, ragPackageIds: updatedIds };
            }
            return prev;
          });

          setConversations((prev) =>
            prev.map((conv) => {
              if (
                updatedConversation &&
                (conv.id === updatedConversation.id || conv.slug === updatedConversation.slug)
              ) {
                return { ...conv, ragPackageIds: updatedIds };
              }
              if (conv.slug === conversationSlug) {
                return { ...conv, ragPackageIds: updatedIds };
              }
              return conv;
            })
          );

          return updatedIds;
        }
      } catch (error) {
        console.error('Error updating RAG packages:', error);
      }

      return null;
    },
    []
  );

  const [selectedRagPackages, setSelectedRagPackages] = useState<string[]>([]);

  // Update selectedRagPackages and model settings when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      setSelectedRagPackages(activeConversation.ragPackageIds || []);
      setSelectedProvider(activeConversation.provider || 'openai');
      setSelectedModel(activeConversation.model || 'gpt-4o-mini');
      setUseSmartSelector(activeConversation.useSmartSelector || false);
    } else {
      setSelectedRagPackages([]);
      // Keep current model settings for new conversations
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id, activeConversation?.ragPackageIds, activeConversation?.provider, activeConversation?.model, activeConversation?.useSmartSelector]);

  const toggleRagPackage = (packageId: string) => {
    // Scenario 1: Active conversation exists - update via API
    if (activeConversation) {
      const currentPackages = activeConversation.ragPackageIds || [];
      const newPackages = currentPackages.includes(packageId)
        ? currentPackages.filter(id => id !== packageId)
        : [...currentPackages, packageId];

      updateConversationRagPackages(activeConversation.slug, newPackages);
      return;
    }

    // Scenario 2: New conversation (not yet created) - update local state
    setSelectedRagPackages(prev =>
      prev.includes(packageId)
        ? prev.filter(id => id !== packageId)
        : [...prev, packageId]
    );
  };

  const updateConversationModelSettings = useCallback(
    async (conversationSlug: string, provider: AIProvider, model: string, useSmartSelector: boolean) => {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationSlug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, model, useSmartSelector }),
        });

        if (!res.ok) throw new Error('Failed to update model settings');

        const data = await res.json();
        if (data.success) {
          setActiveConversation((prev) => {
            if (!prev || prev.slug !== conversationSlug) return prev;
            return { ...prev, provider, model, useSmartSelector };
          });

          setConversations((prev) =>
            prev.map((conv) => {
              if (conv.slug === conversationSlug) {
                return { ...conv, provider, model, useSmartSelector };
              }
              return conv;
            })
          );

          return true;
        }
      } catch (error) {
        console.error('Error updating model settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to update model settings',
          variant: 'destructive',
        });
      }

      return false;
    },
    [toast]
  );

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    // Si no hay conversación activa, crear una primero
    if (!activeConversation) {
      toast({
        title: t('noConversation'),
        description: t('startConversationBeforeUpload'),
        variant: 'destructive',
      });
      return;
    }

    setUploadingFiles(true);
    setUploadProgress(0);

    try {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let uploadedBytes = 0;
      let successCount = 0;

      for (const file of files) {
        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/chat/upload-document');
          xhr.responseType = 'json'; // Important: set response type to JSON

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const current = uploadedBytes + e.loaded;
              setUploadProgress(Math.min(99, Math.round((current / totalBytes) * 100)));
            }
          };

          xhr.onload = () => {
            uploadedBytes += file.size;
            if (xhr.status >= 200 && xhr.status < 300) {
              successCount++;

              // Parse response to get workbook data
              try {
                const response = xhr.response as any;
                if (response?.success && response?.workbook) {
                  console.log('📊 Excel workbook data received:', response.workbook);
                  // Store workbook data by document ID
                  setUploadedExcelData(prev => ({
                    ...prev,
                    [response.documentId]: {
                      filename: response.filename || file.name,
                      workbook: response.workbook
                    }
                  }));
                }
              } catch (e) {
                console.warn('Failed to parse upload response:', e);
              }
            }
            resolve();
          };

          xhr.onerror = () => {
            uploadedBytes += file.size;
            resolve();
          };

          const formData = new FormData();
          formData.append('file', file);
          formData.append('conversationId', activeConversation.id);
          xhr.send(formData);
        });
      }

      setUploadProgress(100);

      if (successCount > 0) {
        toast({
          title: t('documentsUploaded'),
          description: `${successCount} ${t('of')} ${files.length} ${t('file(s)')} ${t('addedAsContext')}`,
        });
      } else {
        toast({
          title: t('uploadError'),
          description: t('noFilesUploaded'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: t('uploadError'),
        description: t('unexpectedError'),
        variant: 'destructive',
      });
    } finally {
      setUploadingFiles(false);
      setUploadProgress(0);
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    // Reset model to first available or keep if valid not handled here, assume selector handles or defaults
    if (activeConversation) {
      // Update existing conversation
      updateConversationModelSettings(activeConversation.slug, provider, selectedModel, useSmartSelector);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (activeConversation) {
      updateConversationModelSettings(activeConversation.slug, selectedProvider, model, useSmartSelector);
    }
  };

  const handleSmartSelectorChange = (enabled: boolean) => {
    setUseSmartSelector(enabled);
    if (activeConversation) {
      updateConversationModelSettings(activeConversation.slug, selectedProvider, selectedModel, enabled);
    }
  };

  const handleAdvancedSearch = async (filters: SearchFilters) => {
    if (!filters.query.trim()) return;

    try {
      const searchParams = new URLSearchParams();
      searchParams.append('query', filters.query);
      searchParams.append('packageIds', (filters.packageIds || []).join(','));
      searchParams.append('limit', String(filters.limit || 20));

      if (filters.method) {
        searchParams.append('method', filters.method);
      }

      if (filters.minScore !== undefined) {
        searchParams.append('minScore', String(filters.minScore));
      }

      const res = await fetch(`/api/rag/search/advanced?${searchParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: filters.packageIds?.[0] || '',
          query: filters.query,
          options: {
            method: filters.method || 'hybrid',
            limit: filters.limit || 20,
            alpha: filters.method === 'lexical' ? 0 : filters.method === 'semantic' ? 1 : 0.5,
            includeMetadata: true,
          },
        }),
      });

      const data = await res.json();
      if (data.results) {
        setAdvancedSearchResults(data.results);
        setShowAdvancedSearchPanel(true);
      }
    } catch (error) {
      console.error('Advanced search error:', error);
      toast({
        title: t('searchError') || 'Search Error',
        description: t('searchErrorDesc') || 'Failed to perform advanced search',
        variant: 'destructive',
      });
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      void handleFileUpload(files);
    }
    event.target.value = '';
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage;
    setNewMessage('');
    setSending(true);

    let conversationToUse = activeConversation;

    // If no active conversation, create one using navigation context
    if (!conversationToUse) {
      const createdConversation = await navigationContext.createOptimisticConversation(
        {
          title: messageContent.substring(0, 50),
          ragPackageIds: selectedRagPackages,
          provider: selectedProvider,
          model: selectedModel,
          useSmartSelector: useSmartSelector,
          assistantId: loadedAssistant?.id || null,
        },
        // onOptimisticUpdate
        (optimisticConversation) => {
          setConversations((prev) => [optimisticConversation, ...prev]);
          setActiveConversation(optimisticConversation);
        },
        // onError
        (error, restoredMessage) => {
          console.error('Error creating conversation:', error);
          setSending(false);
          setThinkingState('idle');
          setNewMessage(restoredMessage);
          toast({
            title: t('error') || 'Error',
            description: error.message,
            variant: 'destructive',
          });
        }
      );

      if (createdConversation) {
        conversationToUse = createdConversation;
      } else {
        return; // Error occurred
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageContent,
      createdAt: new Date().toISOString()
    };

    setActiveConversation({
      ...conversationToUse,
      messages: [...(conversationToUse.messages || []), userMessage]
    });

    // Construct System Prompt
    let systemPrompt = loadedAssistant?.system_prompt;

    if (isReportMode) {
      const reportSchema = JSON.stringify({
        title: "Title of the meeting/report",
        date: "YYYY-MM-DD",
        time: "HH:MM",
        location: "Meeting Location",
        attendees: ["Name 1", "Name 2"],
        guests: ["Guest 1"],
        absent: ["Absent 1"],
        agenda: [{ title: "Topic 1", description: "Details...", duration: "15m" }],
        summary: "Executive summary of the meeting...",
        tasks: [{ id: "1", title: "Task description", assignee: "Name", deadline: "YYYY-MM-DD", status: "open" }],
        nextMeeting: "YYYY-MM-DD"
      }, null, 2);

      const reportPrompt = `
You are an expert secretary and protocol officer.
Your task is to generate a comprehensive Meeting Report (Protocol) based on the conversation context or the specific request.
You MUST output ONLY valid JSON matching the following structure:
${reportSchema}

Guidelines:
- "title": A clear, professional title for the report.
- "summary": A detailed high-level summary of what was discussed.
- "agenda": Extract distinct topics discussed.
- "tasks": Extract action items, actionable tasks, and assignments.
- "attendees": Infer participants if possible, otherwise list generic roles or leave empty.
- Ensure the JSON is well-formed and parseable. Do not include markdown code blocks (like \`\`\`json) outside the JSON.
`;
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${reportPrompt}` : reportPrompt;
    }

    let assistantMessageId = `temp-assistant-${Date.now()}`;

    // Start streaming using context
    await streamingContext.startStream({
      conversationSlug: conversationToUse.slug,
      messageContent,
      ragPackageIds: conversationToUse.ragPackageIds || [],
      systemPrompt,
      webSearchEnabled,
      provider: useSmartSelector ? 'auto' : selectedProvider,
      model: useSmartSelector ? 'auto' : selectedModel,

      // Content chunks - update conversation in real-time
      onContentChunk: (content) => {
        setActiveConversation(prev => {
          if (!prev) return prev;
          const messages = [...(prev.messages || [])];
          const lastMessage = messages[messages.length - 1];

          if (lastMessage?.role === 'assistant') {
            messages[messages.length - 1] = {
              ...lastMessage,
              content: lastMessage.content + content,
              metadata: {
                ...lastMessage.metadata,
                model: streamingContext.modelInfo?.model,
                modelName: streamingContext.modelInfo?.modelName,
                provider: streamingContext.modelInfo?.provider,
              }
            };
          } else {
            messages.push({
              id: assistantMessageId,
              role: 'assistant',
              content,
              createdAt: new Date().toISOString(),
              metadata: {
                model: streamingContext.modelInfo?.model,
                modelName: streamingContext.modelInfo?.modelName,
                provider: streamingContext.modelInfo?.provider,
              }
            });
          }

          return { ...prev, messages };
        });

        // Auto-scroll during streaming
        if (!isScrolledUpRef.current) {
          const viewport = getViewport();
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }
      },

      // Sources received
      onSources: (sources) => {
        messagesContext.setMessageSources(assistantMessageId, sources);
      },

      // Web sources received
      onWebSources: (sources) => {
        messagesContext.setWebSearchSources(assistantMessageId, sources);
      },

      // Model info received
      onModelInfo: (info) => {
        messagesContext.setMessageModelInfo(assistantMessageId, {
          provider: info.provider,
          model: info.model,
          modelName: info.modelName,
        });
      },

      // Stream completed
      onDone: (messageId, tempMessageId) => {
        // Transfer all data from temp ID to real ID
        messagesContext.transferMessageData(tempMessageId, messageId);

        // Update the message ID in the conversation
        setActiveConversation(prev => {
          if (!prev) return prev;
          const messages = [...(prev.messages || [])];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.id === tempMessageId) {
            messages[messages.length - 1] = { ...lastMessage, id: messageId };
          }
          return { ...prev, messages };
        });
      },

      // Error handling
      onError: (error) => {
        console.error('Stream error:', error);
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          toast({
            title: t('rateLimitExceeded'),
            description: t('rateLimitMessage'),
            variant: 'destructive',
          });
        }
        setSending(false);
      }
    });

    setSending(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleMobileMenuButtonClick = () => {
    if (showRagSlider) {
      setShowRagSlider(false);
      setTimeout(() => setMobileSidebarOpen(true), 200);
      return;
    }
    setMobileSidebarOpen(true);
  };

  // Stop generation handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Message feedback handler
  const handleFeedback = async (messageId: string, type: 'up' | 'down') => {
    // Migrated to use context hook
    messagesContext.setMessageFeedback(messageId, type);

    // Send to API for analytics
    try {
      await fetch('/api/chat/messages/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, feedback: type }),
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Pin message handler
  const handlePinMessage = (messageId: string) => {
    // Migrated to use context hook
    messagesContext.pinMessage(messageId);
  };

  // Excel analysis handler
  const handleAnalyzeExcel = (documentId: string, sheetName: string, analysisType: 'summary' | 'patterns' | 'chart') => {
    const excelData = uploadedExcelData[documentId];
    if (!excelData) return;

    const { workbook, filename } = excelData;
    const sheet = workbook.sheets.find((s: any) => s.name === sheetName);
    if (!sheet) return;

    let prompt = '';
    switch (analysisType) {
      case 'summary':
        prompt = `Por favor, analiza y resume los datos de la hoja de Excel "${filename}" - hoja "${sheetName}".\n\n`;
        prompt += `Esta hoja contiene ${sheet.rowCount} filas y ${sheet.columnCount} columnas.\n`;
        prompt += `Columnas: ${sheet.headers.join(', ')}.\n\n`;
        prompt += `Por favor proporciona:\n`;
        prompt += `1. Un resumen general de los datos\n`;
        prompt += `2. Los puntos clave o tendencias principales\n`;
        prompt += `3. Cualquier insight o anomalía notable\n`;
        break;

      case 'patterns':
        prompt = `Por favor, busca patrones y tendencias en los datos de la hoja de Excel "${filename}" - hoja "${sheetName}".\n\n`;
        prompt += `Columnas: ${sheet.headers.join(', ')}.\n`;
        prompt += `Total de filas: ${sheet.rowCount}.\n\n`;
        prompt += `Por favor identifica:\n`;
        prompt += `1. Patrones o tendencias en los datos\n`;
        prompt += `2. Correlaciones entre columnas\n`;
        prompt += `3. Valores atípicos o anomalías\n`;
        prompt += `4. Cualquier estructura o agrupación natural en los datos\n`;
        break;

      case 'chart':
        prompt = `Por favor, crea un gráfico basado en los datos de la hoja de Excel "${filename}" - hoja "${sheetName}".\n\n`;
        prompt += `Columnas disponibles: ${sheet.headers.join(', ')}.\n`;
        prompt += `Total de filas: ${sheet.rowCount}.\n\n`;
        prompt += `Sugiere el mejor tipo de gráfico (bar, line, pie) para visualizar estos datos y genera una especificación para crearlo.\n`;
        prompt += `Incluye qué columnas usar para el eje X y Y, y qué tipo de gráfico sería más apropiado.\n`;
        break;
    }

    setNewMessage(prompt);
    // Trigger send after a short delay to allow the state to update
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  // Export conversation handler
  const handleExportConversation = (format: 'md' | 'json' | 'pdf') => {
    if (!activeConversation) return;

    const exportData = {
      title: activeConversation.title,
      messages: activeConversation.messages || [],
      createdAt: activeConversation.createdAt,
    };

    switch (format) {
      case 'md':
        downloadConversationAsMarkdown(exportData);
        break;
      case 'json':
        downloadConversationAsJSON(exportData);
        break;
      case 'pdf':
        printConversationAsPDF(exportData);
        break;
    }

    toast({
      title: t('exportSuccess') || 'Export successful',
      description: format === 'pdf' ? t('printDialogOpened') || 'Print dialog opened' : t('fileDownloaded') || 'File downloaded',
    });
  };

  // Nutze volle Höhe des Viewports
  const AVAILABLE_HEIGHT = '100dvh';

  return (
    <div
      className="flex flex-col overflow-hidden bg-background lg:flex-row"
      style={{
        minHeight: AVAILABLE_HEIGHT,
        height: AVAILABLE_HEIGHT,
      }}
    >
      <input
        ref={filePickerRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleFileInputChange}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv"
      />
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <div
          className={`h-full overflow-hidden transition-[width] duration-200 ease-out ${sidebarCollapsed ? 'w-16' : 'w-72'
            }`}
        >
          <ChatSidebar
            conversations={conversations}
            onNewChat={() => router.push('/chat')}
            currentConversationId={activeConversation?.id}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            isLoading={loadingConversations}
            onConversationUpdated={fetchConversations}
            teamSlug={teamSlug || ''}
          />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-x-0 bottom-0 z-40 bg-black/40 animate-in fade-in duration-200"
            style={{ top: 0, bottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div
            className="fixed left-0 z-50 flex w-full max-w-xs bg-white dark:bg-zinc-900 shadow-2xl border-r border-border animate-in slide-in-from-left duration-300"
            style={{
              top: 0,
              bottom: 'env(safe-area-inset-bottom, 0px)',
              height: AVAILABLE_HEIGHT,
            }}
          >
            <ChatSidebar
              conversations={conversations}
              onNewChat={() => router.push('/chat')}
              currentConversationId={activeConversation?.id}
              isCollapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
              isLoading={loadingConversations}
              onConversationUpdated={fetchConversations}
              className="w-full pb-6 pr-1 [padding-bottom:calc(env(safe-area-inset-bottom)+1.5rem)]"
              onNavigate={() => setMobileSidebarOpen(false)}
              teamSlug={teamSlug || ''}
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col min-h-0 relative">
        {/* Animated Messages Area */}
        <AnimatePresence mode="wait">
          {loadingActiveConversation ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-1 flex-col overflow-hidden min-h-0"
            >
              <ScrollArea ref={scrollAreaRef} className="flex-1 px-3 sm:px-6">
                <ChatMessagesAreaSkeleton />
                <div className="h-32 sm:h-24" />
              </ScrollArea>
            </motion.div>
          ) : activeConversation ? (
            <motion.div
              key={`chat-${activeConversation.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-1 flex-col overflow-hidden min-h-0"
            >
              <div className="flex flex-1 flex-col overflow-hidden min-h-0">
              {/* Messages */}
              <ScrollArea ref={scrollAreaRef} className="flex-1 px-3 sm:px-6">
                <div
                  className={`mx-auto max-w-3xl space-y-4 pt-4 sm:space-y-5 sm:pt-5 ${isMobileViewport
                    ? 'pb-[calc(env(safe-area-inset-bottom)+2rem)]'
                    : 'pb-2'
                    }`}
                >
                  {loadingOlderMessages && (
                    <div className="flex justify-center py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}

                  {/* Excel Viewer - shows recently uploaded Excel files */}
                  {Object.keys(uploadedExcelData).length > 0 && (
                    <div className="mb-4 space-y-4">
                      {Object.entries(uploadedExcelData).map(([documentId, { filename, workbook }]) => (
                        <ExcelViewer
                          key={documentId}
                          workbookData={workbook}
                          filename={filename}
                          onAnalyze={(sheetName, analysisType) => handleAnalyzeExcel(documentId, sheetName, analysisType)}
                        />
                      ))}
                    </div>
                  )}

                  {activeConversation.messages && activeConversation.messages.length > 0 ? (
                    activeConversation.messages.map((message, idx) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: idx * 0.05, // Stagger effect for multiple messages
                          ease: [0.4, 0, 0.2, 1]
                        }}
                        className="space-y-2"
                      >
                        {/* ...Message-Rendering wie gehabt... */}
                        {message.role === 'assistant' && (
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                                <Image
                                  src="/nexary-logo.webp"
                                  alt={message.metadata?.modelName || messageModelInfo[message.id]?.modelName || t('azureOpenAI') || 'Nexary AI'}
                                  width={24}
                                  height={24}
                                  className="h-5 w-5 rounded-full bg-white"
                                />
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {message.metadata?.modelName || messageModelInfo[message.id]?.modelName || t('azureOpenAI') || 'Nexary AI'}
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
                              onClick={() => handlePinMessage(message.id)}
                              title={pinnedMessages.has(message.id) ? t('unpinMessage') || 'Unpin' : t('pinMessage') || 'Pin'}
                            >
                              <Pin className={`h-3.5 w-3.5 ${pinnedMessages.has(message.id) ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
                            </Button>
                          </div>
                        )}
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
                              if (report) {
                                return (
                                  <div className="my-2">
                                    <ReportCard
                                      protocol={report}
                                      onViewFull={() => {
                                        console.log('👀 View Full Report Clicked', report);
                                        setViewingReport(report);
                                        setIsReportViewerOpen(true);
                                      }}
                                      onDownload={() => downloadReportAsPDF(report)}
                                    />
                                  </div>
                                );
                              }
                              return (
                                <>
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
                                            <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono" {...props}>
                                              {children}
                                            </code>
                                          );
                                        },
                                        pre({ children }) {
                                          // Let the code component handle the wrapper
                                          return <>{children}</>;
                                        },
                                        // Custom paragraph renderer to style source citations
                                        p({ children, ...props }) {
                                          // Process children to find and style [Source: ...] patterns
                                          const processChildren = (child: React.ReactNode): React.ReactNode => {
                                            if (typeof child === 'string') {
                                              // Match [Source: filename] pattern
                                              const sourcePattern = /\[Source:\s*([^\]]+)\]/g;
                                              const parts = [];
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
                                        },
                                      }}
                                    >
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>

                                  {/* Sources Panel */}
                                  {messageSources[message.id]?.length > 0 && (
                                    <>
                                      {useEnhancedCitations ? (
                                        <EnhancedCitations
                                          sources={messageSources[message.id]}
                                          className="mt-4"
                                          onJumpToDocument={(documentId, pageNumber) => {
                                            router.push(`/dashboard/documents?highlight=${documentId}&page=${pageNumber}`);
                                          }}
                                        />
                                      ) : (
                                        <RagVisualization
                                          sources={messageSources[message.id]}
                                          className="mt-4"
                                        />
                                      )}
                                    </>
                                  )}

                                  {/* Web Search Sources Panel - Compact */}
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
                                          <span className="truncate">{source.source || new URL(source.url).hostname}</span>
                                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        navigator.clipboard.writeText(message.content);
                                        toast({
                                          title: t('copied'),
                                          description: t('responseCopied'),
                                        });
                                      }}
                                    >
                                      <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      {t('copy')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        const messageIndex = activeConversation.messages?.findIndex(
                                          (m) => m.id === message.id
                                        ) ?? -1;
                                        const previousUserMessage =
                                          messageIndex > 0
                                            ? [...(activeConversation.messages ?? [])]
                                              .slice(0, messageIndex)
                                              .reverse()
                                              .find((m) => m.role === 'user')
                                            : undefined;
                                        if (previousUserMessage) {
                                          setNewMessage(previousUserMessage.content);
                                          void sendMessage();
                                        }
                                      }}
                                    >
                                      <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      {t('regenerate')}
                                    </Button>

                                    {/* Separator */}
                                    <div className="h-4 w-px bg-border mx-1" />

                                    {/* Feedback buttons */}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={`h-7 w-7 ${messageFeedback[message.id] === 'up' ? 'text-green-600 bg-green-50 dark:bg-green-950' : 'text-muted-foreground hover:text-foreground'}`}
                                      onClick={() => handleFeedback(message.id, 'up')}
                                      title={t('helpfulResponse') || 'Helpful'}
                                    >
                                      <ThumbsUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={`h-7 w-7 ${messageFeedback[message.id] === 'down' ? 'text-red-600 bg-red-50 dark:bg-red-950' : 'text-muted-foreground hover:text-foreground'}`}
                                      onClick={() => handleFeedback(message.id, 'down')}
                                      title={t('notHelpfulResponse') || 'Not helpful'}
                                    >
                                      <ThumbsDown className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>

                                  {/* Reasoning Display - shown after completion for models with reasoning */}
                                  {messageReasoning[message.id] && (
                                    <div className="mt-3">
                                      <ReasoningDisplay
                                        reasoning={messageReasoning[message.id]}
                                        modelName={modelInfo?.modelName || selectedModel}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          ) : message.role === 'system' ? (
                            <div className="rounded-2xl bg-muted/70 px-4 py-2 text-xs text-muted-foreground">
                              {message.content}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words text-sm">
                              {message.content}
                            </div>
                          )}
                        </div>
                        {/* Ref am letzten Element */}
                        {activeConversation.messages && idx === activeConversation.messages.length - 1 && <div ref={messagesEndRef} />}
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      {t('startConversation')}
                    </div>
                  )}

                  {/* Thinking Indicator - Shows BEFORE streaming starts, disappears when content arrives */}
                  <AnimatePresence mode="wait">
                    {(thinkingState === 'thinking' || thinkingState === 'reasoning') && (
                      <motion.div
                        key="thinking-indicator"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="py-4"
                      >
                        <div className="flex items-center gap-3">
                          {/* Animated icon */}
                          <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-ping" />
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
                              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                            </div>
                          </div>

                          {/* Model info */}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">
                              {modelInfo?.modelName || t('thinking')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{t('generatingResponse')}</span>
                              {/* Animated dots */}
                              <span className="flex items-center gap-0.5">
                                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </span>
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-1 flex-col min-h-0 overflow-hidden"
          >
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-16">
              {loadedAssistant ? (
                <>
                  {/* Assistant Avatar with Custom Color */}
                  <div
                    className="mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-lg text-3xl"
                    style={{ backgroundColor: loadedAssistant.avatar_color || '#6366f1' }}
                  >
                    {loadedAssistant.icon || '🤖'}
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">
                    {loadedAssistant.name}
                  </h2>

                  {/* Welcome Message */}
                  {loadedAssistant.welcome_message ? (
                    <p className="max-w-lg text-sm text-muted-foreground mb-4">
                      {loadedAssistant.welcome_message}
                    </p>
                  ) : loadedAssistant.description ? (
                    <p className="max-w-lg text-sm text-muted-foreground mb-4">
                      {loadedAssistant.description}
                    </p>
                  ) : null}

                  {/* Context Questions (if any) */}
                  {loadedAssistant.context_questions && loadedAssistant.context_questions.length > 0 && (
                    <div className="mb-6 max-w-lg">
                      <p className="text-xs text-muted-foreground mb-2">{t('contextQuestionsIntro') || 'Para ayudarte mejor, primero responde:'}</p>
                      <div className="space-y-2">
                        {loadedAssistant.context_questions.map((question: string, idx: number) => (
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

                  {/* Sample Prompts as Clickable Buttons */}
                  {loadedAssistant.sample_prompts && loadedAssistant.sample_prompts.length > 0 && (
                    <div className="mb-4 max-w-lg">
                      <p className="text-xs text-muted-foreground mb-3">{t('samplePromptsIntro') || 'Sugerencias rápidas:'}</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {loadedAssistant.sample_prompts.map((prompt: string, idx: number) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
                            onClick={() => {
                              setNewMessage(prompt);
                              // Auto-send after a short delay
                              setTimeout(() => {
                                sendMessage();
                              }, 100);
                            }}
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
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md">
                    <Image
                      src="/nexary-logo.webp"
                      alt="Nexary"
                      width={48}
                      height={48}
                      className="h-12 w-12"
                    />
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">
                    {t('nexarySmart')}
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t('startConversation')}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Chat Input - ALWAYS VISIBLE (outside conditionals, like sidebar) */}
        <div className="flex-shrink-0">
          {/* Advanced Search Toggle */}
          <div className="border-b border-border/40 bg-muted/30 px-3 py-2 flex items-center justify-center">
            <Button
              variant={showAdvancedSearchPanel ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowAdvancedSearchPanel(!showAdvancedSearchPanel)}
            >
              <Search className="h-3 w-3" />
              {showAdvancedSearchPanel ? (t('hideAdvancedSearch') || 'Hide Advanced Search') : (t('showAdvancedSearch') || 'Advanced Search')}
            </Button>
          </div>

          {/* Advanced Search Panel */}
          {showAdvancedSearchPanel && (
            <div className="border-b border-border bg-card/50 p-3">
              <AdvancedSearch
                onSearch={handleAdvancedSearch}
                availablePackages={ragPackages}
                defaultFilters={{
                  packageIds: selectedRagPackages,
                }}
                className="max-w-3xl mx-auto"
              />
            </div>
          )}
          <ChatInput
            newMessage={newMessage}
            onMessageChange={setNewMessage}
            onSendMessage={sendMessage}
            onStopGeneration={handleStopGeneration}
            onKeyDown={handleKeyDown}
            onFileUploadClick={() => filePickerRef.current?.click()}
            sending={sending}
            creatingConversation={creatingConversation}
            uploadingFiles={uploadingFiles}
            onToggleRagSlider={() => setShowRagSlider(true)}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            useSmartSelector={useSmartSelector}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onSmartSelectorChange={handleSmartSelectorChange}
            onExportConversation={handleExportConversation}
            hasActiveConversation={!!activeConversation}
            loadedAssistant={loadedAssistant}
            onSamplePromptClick={(prompt) => {
              setNewMessage(prompt);
              setTimeout(() => sendMessage(), 100);
            }}
            showScrollToBottom={false}
            onScrollToBottom={() => scrollToBottom('smooth')}
            isMobileViewport={isMobileViewport}
            hideWelcomeScreen={true}
          />
        </div>

        {/* Scroll to bottom button - outside ChatInput to ensure it's above all content */}
        {isScrolledUp && activeConversation && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[100]">
            <Button
              onClick={() => scrollToBottom('smooth')}
              size="icon"
              className="h-10 w-10 rounded-full shadow-xl bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 border border-zinc-600 animate-in fade-in slide-in-from-bottom-2 duration-200"
              title="Scroll to bottom"
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
      {!mobileSidebarOpen && (
        <Button
          type="button"
          onClick={handleMobileMenuButtonClick}
          size="icon"
          className="fixed left-4 z-[60] rounded-full shadow-lg lg:hidden"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
          aria-label={t('openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <ChatRagSlider
        open={showRagSlider}
        setOpenAction={setShowRagSlider}
        ragPackages={ragPackages}
        selectedPackageIds={selectedRagPackages}
        onTogglePackageAction={toggleRagPackage}
        onRequestUpload={() => filePickerRef.current?.click()}
        canManagePackages={true}
        isUploading={uploadingFiles}
        uploadProgress={uploadProgress}
        conversationId={activeConversationId}
      />
      <ReportViewerDialog
        open={isReportViewerOpen}
        onOpenChange={setIsReportViewerOpen}
        protocol={viewingReport}
        onDownload={() => viewingReport && downloadReportAsPDF(viewingReport)}
      />
    </div>
  );
}

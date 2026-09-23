# Chat Layout Refactoring Plan

## Current State
The `chat-layout.tsx` file is **~2200 lines** and handles too many responsibilities:
- Message rendering and streaming
- UI state management
- Navigation and routing
- File uploads
- RAG integration
- Advanced search
- Export functionality
- Monitoring and analytics

## Proposed Component Structure

### 1. Core Layout Components
```
components/chat/
├── ChatLayout.tsx (main orchestrator, ~200 lines)
├── ChatMessagesArea.tsx (messages display + scroll)
├── ChatThinkingIndicator.tsx (animated thinking state)
├── ChatWelcomeScreen.tsx (empty state with prompts)
└── ChatMessageList.tsx (message rendering with animations)
```

### 2. Feature Components
```
components/chat/
├── features/
│   ├── ChatFileUpload.tsx (file handling + progress)
│   ├── ChatAdvancedSearch.tsx (search integration)
│   ├── ChatRagSelector.tsx (RAG package selection)
│   ├── ChatExport.tsx (export functionality)
│   └── ChatReasoningDisplay.tsx (o1 reasoning display)
```

### 3. Hooks (Business Logic)
```
hooks/chat/
├── useChatMessages.ts (message CRUD + streaming)
├── useChatNavigation.ts (routing + optimistic UI)
├── useChatStreaming.ts (stream handling + thinking states)
├── useChatFiles.ts (file uploads + Excel viewer)
├── useChatRag.ts (RAG package management)
└── useChatExport.ts (export conversations)
```

## Component Breakdown

### ChatLayout.tsx (Main Container)
**Responsibilities:**
- Layout orchestration
- State aggregation
- Event delegation

**Props:**
```typescript
interface ChatLayoutProps {
  teamSlug: string;
  assistantId?: string;
}
```

**Example:**
```tsx
export function ChatLayout({ teamSlug, assistantId }: ChatLayoutProps) {
  const messages = useChatMessages();
  const streaming = useChatStreaming();
  const navigation = useChatNavigation();

  return (
    <div className="flex h-screen">
      <ChatSidebar />
      <div className="flex-1 flex flex-col">
        <ChatMessagesArea
          messages={messages.data}
          streaming={streaming.isActive}
        />
        <ChatInput />
      </div>
    </div>
  );
}
```

### ChatMessagesArea.tsx
**Responsibilities:**
- Scroll management
- Messages rendering
- Thinking indicator integration

**Props:**
```typescript
interface ChatMessagesAreaProps {
  messages: ChatMessage[];
  streaming: boolean;
  onScrollToBottom?: () => void;
}
```

### ChatMessageList.tsx
**Responsibilities:**
- Individual message rendering
- Message animations
- Message actions (pin, feedback, copy)

**Props:**
```typescript
interface ChatMessageListProps {
  messages: ChatMessage[];
  onPinMessage?: (id: string) => void;
  onFeedback?: (id: string, type: 'up' | 'down') => void;
}
```

### ChatThinkingIndicator.tsx
**Responsibilities:**
- Animated thinking state
- Model info display
- Smooth transition to streaming

**Current Implementation:** ✅ Already animated with Framer Motion

### useChatMessages.ts
**Responsibilities:**
- Message CRUD operations
- Message state management
- Message persistence

**API:**
```typescript
export function useChatMessages(conversationId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  return {
    messages,
    addMessage,
    updateMessage,
    // ... other operations
  };
}
```

### useChatStreaming.ts
**Responsibilities:**
- Stream connection management
- Thinking state transitions
- Content chunk processing

**API:**
```typescript
export function useChatStreaming() {
  const [thinkingState, setThinkingState] = useState<'idle' | 'thinking' | 'streaming'>('idle');
  const [content, setContent] = useState('');

  const startStream = useCallback(async (conversationId: string, message: string) => {
    setThinkingState('thinking');
    // Stream logic...
  }, []);

  return {
    thinkingState,
    content,
    startStream,
    stopStream,
  };
}
```

## Benefits of Componentization

### 1. Maintainability
- Each component has a single responsibility
- Easier to locate and fix bugs
- Reduced cognitive load when working on features

### 2. Testability
- Components can be tested in isolation
- Hooks can be tested independently
- Easier to mock dependencies

### 3. Reusability
- Chat components can be reused in other contexts
- Hooks can be shared across different chat implementations
- Consistent behavior across the app

### 4. Performance
- Better memoization opportunities
- Reduced re-renders through proper state management
- Code splitting by route/feature

### 5. Developer Experience
- Faster development with smaller, focused files
- Easier onboarding for new developers
- Better TypeScript inference

## Migration Strategy

### Phase 1: Extract Hooks (Low Risk)
1. Create `hooks/chat/` directory
2. Extract business logic from chat-layout.tsx
3. Update chat-layout.tsx to use new hooks
4. Test thoroughly

**Estimated Time:** 2-3 days

### Phase 2: Extract UI Components (Medium Risk)
1. Create new component files
2. Move JSX from chat-layout.tsx to components
3. Add prop types and default values
4. Test each component in isolation

**Estimated Time:** 3-4 days

### Phase 3: Integrate and Refine (Low Risk)
1. Update ChatLayout to use new components
2. Remove old code from chat-layout.tsx
3. Add error boundaries
4. Performance optimization

**Estimated Time:** 1-2 days

## Additional Improvements Identified

### Animations & Transitions
✅ **Completed:**
- Optimistic UI for new chat creation
- Smooth transition from /chat to /chat/[id]
- Animated thinking indicator with fade-out
- Message entrance animations with stagger

🔄 **Recommended:**
- Sidebar conversation item animations
- Toast notification animations (use existing Sonner with transitions)
- Modal/Dialog animations (shadcn/ui Dialog supports this)
- Button hover states (add `transition-all duration-200`)

### Performance Optimizations
1. **Virtual Scrolling** for long conversations (react-window)
2. **Message Memoization** to prevent unnecessary re-renders
3. **Code Splitting** for heavy features (advanced search, Excel viewer)
4. **Image Lazy Loading** for message attachments

### Accessibility
1. **Keyboard Navigation** for message actions
2. **ARIA Labels** for all interactive elements
3. **Screen Reader Announcements** for new messages
4. **Focus Management** for modals and dialogs

## Next Steps

1. **Review this plan** with the team
2. **Prioritize components** based on current pain points
3. **Create a tracking board** for the migration
4. **Start with Phase 1** (hook extraction) as it's low risk
5. **Set up testing infrastructure** before major refactoring

## Estimated Total Time
- **Phase 1:** 2-3 days
- **Phase 2:** 3-4 days
- **Phase 3:** 1-2 days
- **Total:** 6-9 days for complete migration

## Notes
- Keep the chat-layout.tsx file working throughout the migration
- Create feature branches for each phase
- Write tests for new components as they're created
- Document any breaking changes or API shifts

## Actualización del Frontend para Soportar Streaming

### Archivo: `app/chat/chat-layout.tsx`

Reemplazar la función `sendMessage` con esta versión que soporta streaming:

```typescript
const [streamingMessage, setStreamingMessage] = useState<string>('');
const [sources, setSources] = useState<Array<{ filename: string; preview: string; score: number }>>([]);

const sendMessage = async () => {
  if (!newMessage.trim() || !activeConversation || sending) return;

  setSending(true);
  const userMessage = newMessage.trim();
  setNewMessage('');
  setSources([]);
  setStreamingMessage('');

  try {
    // Add user message to UI immediately
    setActiveConversation(prev => prev ? {
      ...prev,
      messages: [
        ...(prev.messages || []),
        {
          id: 'temp-user',
          role: 'user' as const,
          content: userMessage,
          createdAt: new Date().toISOString(),
        }
      ]
    } : null);

    // Call streaming endpoint
    const response = await fetch(`/api/chat/conversations/${activeConversation.id}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: userMessage,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error('Failed to start stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'sources') {
              setSources(data.sources);
            } else if (data.type === 'content') {
              accumulatedText += data.content;
              setStreamingMessage(accumulatedText);
            } else if (data.type === 'done') {
              // Refresh conversation to get the saved message
              const res = await fetch(`/api/chat/conversations/${activeConversation.id}`);
              const conversationData = await res.json();
              if (res.ok && conversationData.success) {
                setActiveConversation(conversationData.conversation);
                setConversations(prev => 
                  prev.map(c => c.id === activeConversation.id ? conversationData.conversation : c)
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                );
              }
              setStreamingMessage('');
              setSources([]);
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
              throw new Error(data.error);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    // Remove temporary user message on error
    setActiveConversation(prev => prev ? {
      ...prev,
      messages: (prev.messages || []).filter(m => m.id !== 'temp-user')
    } : null);
  } finally {
    setSending(false);
    setStreamingMessage('');
  }
};
```

### Actualizar el renderizado de mensajes para mostrar streaming:

```typescript
{/* Messages */}
<ScrollArea className="flex-1 p-4">
  <div className="space-y-4 max-w-4xl mx-auto">
    {activeConversation.messages?.map((message) => (
      // ... código existente ...
    ))}
    
    {/* Streaming message */}
    {sending && streamingMessage && (
      <div className="flex gap-3 justify-start">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-500 text-white text-xs">
            AI
          </AvatarFallback>
        </Avatar>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[70%]">
          {sources.length > 0 && (
            <div className="mb-2 pb-2 border-b border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">
                📚 Fuentes consultadas:
              </div>
              <div className="flex flex-wrap gap-1">
                {sources.map((source, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                    title={source.preview}
                  >
                    {source.filename}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div 
            className="text-sm prose prose-sm max-w-none markdown-content"
            dangerouslySetInnerHTML={{ 
              __html: streamingMessage
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br />')
                .replace(/^(.*)$/, '<p>$1</p>')
            }}
          />
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Escribiendo...
          </div>
        </div>
      </div>
    )}
    
    {/* Loading indicator when starting */}
    {sending && !streamingMessage && (
      <div className="flex gap-3 justify-start">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-500 text-white text-xs">
            AI
          </AvatarFallback>
        </Avatar>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    )}
  </div>
</ScrollArea>
```

## Instalación

1. **Instalar dependencias nuevas:**
   ```bash
   npm install xlsx adm-zip
   npm install --save-dev @types/adm-zip
   ```

2. **Reiniciar el servidor:**
   ```bash
   npm run dev
   ```

3. **Probar:**
   - Sube un archivo Excel o PowerPoint
   - Haz una pregunta en el chat
   - Observa el streaming en tiempo real

## Notas

- El streaming funciona con cualquier modelo de OpenAI que lo soporte
- Las fuentes se muestran antes de la respuesta
- El texto aparece palabra por palabra para mejor UX

import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { addMessage, getConversation } from '@/lib/chat';
import { allowedRagIds } from '@/lib/authz';
import { checkAndIncrementUsage, recordUsageEvent } from '@/lib/billing/limits';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const userEmail = (user as { primaryEmail?: string | null }).primaryEmail || '';

  try {
    // Verify user owns the conversation
    const conversation = await getConversation(conversationId, userEmail);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Add user message
    const userMessage = await addMessage({
      conversationId,
      role: 'user',
      content,
      metadata: {},
    });

    let assistantResponse = '';
    let ragContext = '';

    // If conversation has RAG packages, search for relevant content
    if (conversation.ragPackageIds && conversation.ragPackageIds.length > 0) {
      try {
        const internalUrl = process.env.INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
        // Use internal RAG API to search
        const ragResponse = await fetch(`${internalUrl}/api/rag/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || '', // Forward session
          },
          body: JSON.stringify({
            query: content,
            packageIds: conversation.ragPackageIds,
            limit: 10,
          }),
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();

          if (ragData.success && ragData.results && ragData.results.length > 0) {
            type RAGResult = {
              content: string;
              metadata?: {
                filename?: string;
              };
            };
            const results: RAGResult[] = ragData.results.slice(0, 5); // Top 5 results

            ragContext = results
              .map((result: RAGResult) => `[${result.metadata?.filename || 'Documento'}]: ${result.content}`)
              .join('\n\n');

            // Generate response using LLM based on RAG context
            try {
              const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
              if (!apiKey) {
                throw new Error('No API key available');
              }

              const contextForLLM = results
                .map((result: RAGResult) => `Documento: ${result.metadata?.filename || 'Sin nombre'}\nContenido: ${result.content}`)
                .join('\n\n---\n\n');

              const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: process.env.CHAT_MODEL || 'gpt-4o-mini',
                  messages: [
                    {
                      role: 'system',
                      content: `Du bist ein hilfreicher Assistent, der Fragen basierend auf bereitgestellten Dokumenten beantwortet.
Deine Aufgaben sind:
1. Die bereitgestellten Dokumente zu analysieren
2. Die Frage des Benutzers klar und strukturiert zu beantworten
3. Quellen zu zitieren, wenn es angemessen ist
4. Wenn die Information nicht in den Dokumenten vorhanden ist, dies klar zu erwähnen
5. Markdown-Format zur besseren Lesbarkeit zu verwenden

Antworte immer auf Deutsch, es sei denn, der Benutzer fragt ausdrücklich in einer anderen Sprache.`
                    },
                    {
                      role: 'user',
                      content: `Benutzerfrage: ${content}

Verfügbare Dokumente:
${contextForLLM}

Bitte beantworte die Frage des Benutzers basierend auf den Informationen aus den Dokumenten.`
                    }
                  ],
                  temperature: 0.7,
                  max_tokens: 1000,
                }),
              });

              if (!llmResponse.ok) {
                throw new Error('LLM request failed');
              }

              const llmData = await llmResponse.json();
              assistantResponse = llmData.choices?.[0]?.message?.content || 
                'No pude generar una respuesta. Por favor, intenta de nuevo.';
              
            } catch (llmError) {
              console.error('[Chat Query] LLM generation failed, falling back to simple response', llmError);

              // Fallback: respuesta simple pero estructurada
              assistantResponse = `Basierend auf den verfügbaren Dokumenten habe ich relevante Informationen gefunden:\n\n${results.map((result: RAGResult, index: number) =>
                `**${index + 1}. Aus "${result.metadata?.filename || 'Dokument'}":**\n${result.content}`
              ).join('\n\n---\n\n')}\n\nMöchtest du, dass ich auf einen bestimmten Aspekt näher eingehe?`;
            }
          } else {
            // No results found
            console.warn('[Chat Query] No relevant RAG results found', {
              resultsLength: ragData.results?.length,
              packageIds: conversation.ragPackageIds
            });

            assistantResponse = `Ich habe keine spezifischen Informationen zu "${content}" in den mit dieser Konversation verknüpften Dokumenten gefunden.

Die RAG-Pakete sind verfügbar, enthalten aber keine relevanten Informationen für deine Anfrage. Könntest du deine Frage umformulieren oder mehr Kontext bereitstellen?`;
          }
        } else {
          const errorText = await ragResponse.text();
          console.error('[Chat Query] RAG API call failed', {
            status: ragResponse.status,
            statusText: ragResponse.statusText,
            errorBody: errorText
          });
          throw new Error('RAG API call failed');
        }
      } catch (ragError) {
        console.error('[Chat Query] Error searching RAG:', {
          error: ragError instanceof Error ? ragError.message : String(ragError),
          stack: ragError instanceof Error ? ragError.stack : undefined,
          packageIds: conversation.ragPackageIds,
          query: content
        });
        assistantResponse = `Es gab ein Problem beim Durchsuchen der Dokumente. Ich kann dir jedoch mit allgemeinen Informationen zu "${content}" helfen.

Für präzisere Antworten basierend auf deinen Dokumenten, versuche es bitte erneut oder kontaktiere den Administrator, wenn das Problem weiterhin besteht.`;
      }
    } else {
      // No RAG packages associated - Use AI as general assistant
      try {
        const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
        if (!apiKey) {
          throw new Error('No API key available');
        }

        // Get conversation history for context (last 10 messages)
        const recentMessages = conversation.messages?.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })) || [];

        const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.CHAT_MODEL || 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Du bist ein hilfreicher, freundlicher und professioneller KI-Assistent namens Nexus AI.
Dein Ziel ist es, dem Benutzer bei jeder Frage oder Aufgabe klar und effektiv zu helfen.

Fähigkeiten:
- Fragen zu verschiedenen Themen beantworten
- Bei Programmierung, Schreiben, Analyse und mehr helfen
- Klare und strukturierte Erklärungen liefern
- Markdown-Format zur besseren Lesbarkeit verwenden

Richtlinien:
- Antworte immer auf Deutsch, es sei denn ausdrücklich anders gewünscht
- Sei prägnant aber vollständig
- Wenn du dir nicht sicher bist, gib es zu
- Verwende Listen, Fettschrift und Formatierung wenn angemessen`
              },
              ...recentMessages,
              {
                role: 'user',
                content: content
              }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!llmResponse.ok) {
          const errorData = await llmResponse.json();
          console.error('[Chat Query] OpenAI API error:', errorData);
          throw new Error('OpenAI API request failed');
        }

        const llmData = await llmResponse.json();
        assistantResponse = llmData.choices?.[0]?.message?.content || 
          'Entschuldigung, ich konnte keine Antwort generieren. Bitte versuche es erneut.';
        
      } catch (llmError) {
        console.error('[Chat Query] Failed to use AI assistant', llmError);
        assistantResponse = `Entschuldigung, ich konnte deine Anfrage derzeit nicht verarbeiten.

**Tipp:** Du kannst RAG-Pakete mit dieser Konversation verbinden, um Antworten basierend auf deinen spezifischen Dokumenten zu erhalten. Gehe zur RAG-Registerkarte, um deine Dokumentenpakete zu erstellen und zu verwalten.

Fehler: ${llmError instanceof Error ? llmError.message : 'Unbekannter Fehler'}`;
      }
    }

    // Add assistant message
    const assistantMessage = await addMessage({
      conversationId,
      role: 'assistant',
      content: assistantResponse,
      metadata: {
        ragContext: ragContext || undefined,
        ragPackageIds: conversation.ragPackageIds,
        searchQuery: content,
      },
    });

    return NextResponse.json({
      success: true,
      userMessage,
      assistantMessage,
      ragContext: ragContext || null,
    });
  } catch (error) {
    console.error('Error processing chat query:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process query' },
      { status: 500 }
    );
  }
}

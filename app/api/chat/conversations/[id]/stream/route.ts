import { NextRequest } from "next/server";
import { StackServerApp } from "@stackframe/stack";
import { addMessage, getConversation, getConversationBySlug } from "@/lib/chat";
import {
  streamChatCompletion,
  getRecommendedModel,
  getModel,
  type AIProvider,
} from "@/lib/ai-providers";
import { chatRateLimiter } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit/logger";
import { logAiUsage } from "@/lib/ai/cost-tracker";
import { query } from "@/lib/db";

const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
});

// Helper function to check if a model supports reasoning
function isReasoningModel(model: string): boolean {
  return model.startsWith('o1-') || model.startsWith('o1') || model.includes('sonnet');
}

// Helper function to check if provider uses Anthropic format
function isAnthropicProvider(provider: AIProvider): boolean {
  return provider === 'anthropic';
}

// Helper function to get model display name
function getModelDisplayName(model: string, provider: AIProvider): string {
  const modelObj = getModel(provider, model);
  return modelObj?.name || model;
}

type DetectedLanguage = {
  code: string;
  label: string;
};

const LANGUAGE_HEURISTICS: Array<{
  code: string;
  label: string;
  pattern?: RegExp;
  keywords: string[];
  priority?: number; // Higher priority languages are checked first
}> = [
    {
      code: "de",
      label: "German",
      priority: 10, // High priority for German users
      pattern: /[äöüßÄÖÜ]/, // German unique characters
      keywords: [
        // Definite articles - highly distinctive
        " der ",
        " die ",
        " das ",
        " den ",
        " dem ",
        " des ",
        // Indefinite articles
        " ein ",
        " eine ",
        " einen ",
        " einem ",
        " einer ",
        " eines ",
        // Prepositions - distinctive
        " aus ",
        " bei ",
        " mit ",
        " nach ",
        " seit ",
        " von ",
        " zu ",
        " über ",
        " unter ",
        // Conjunctions
        " und ",
        " oder ",
        " aber ",
        " weil ",
        " wenn ",
        " obwohl ",
        " denn ",
        // Pronouns - highly distinctive
        " ich ",
        " du ",
        " er ",
        " sie ",
        " es ",
        " wir ",
        " ihr ",
        " Sie ",
        " mich ",
        " dich ",
        " uns ",
        " euch ",
        " ihm ",
        " ihr ",
        // Verbs (present) - highly distinctive
        " bin ",
        " bist ",
        " ist ",
        " sind ",
        " seid ",
        " habe ",
        " hast ",
        " hat ",
        " haben ",
        " habt ",
        " gehe ",
        " gehst ",
        " geht ",
        " gehen ",
        " geht ",
        " kann ",
        " kannst ",
        " kann ",
        " können ",
        " könnt ",
        " will ",
        " willst ",
        " will ",
        " wollen ",
        " wollt ",
        " mache ",
        " machst ",
        " macht ",
        " machen ",
        " macht ",
        // Question words
        " was ",
        " wer ",
        " wie ",
        " wo ",
        " wann ",
        " warum ",
        " welch ",
        // Common words - distinctive
        " nicht ",
        " auch ",
        " schon ",
        " noch ",
        " nur ",
        " ja ",
        " nein ",
        " sehr ",
        " gut ",
        " mal ",
        " halt ",
        " eben ",
        " doch ",
        " mal ",
        " nur ",
        " wirklich ",
        " eigentlich ",
        // Time expressions
        " heute ",
        " gestern ",
        " morgen ",
        " jetzt ",
        " oft ",
        " immer ",
        " nie ",
        " manchmal ",
        // Possessives
        " mein ",
        " meine ",
        " meinen ",
        " meines ",
        " dein ",
        " deine ",
        " deinen ",
        " deines ",
        " sein ",
        " seine ",
        " seinen ",
        " seines ",
        " ihr ",
        " ihre ",
        " ihren ",
        " ihres ",
        // Distinctive German words
        " das ",
        " dass ",
        " dieser ",
        " diese ",
        " dieses ",
        " jener ",
        " jene ",
        " für ",
        " durch ",
        " ohne ",
        " um ",
        " gegen ",
        " an ",
        " auf ",
        " in ",
        " neben ",
      ],
    },
    {
      code: "es",
      label: "Spanish",
      priority: 10, // High priority for Spanish users
      pattern: /[¿¡ñáéíóúü]/, // Spanish punctuation and unique characters
      keywords: [
        // Articles - common but shared with other languages
        " el ",
        " la ",
        " los ",
        " las ",
        " un ",
        " una ",
        " unos ",
        " unas ",
        // Prepositions
        " del ",
        " al ",
        " por ",
        " para ",
        " con ",
        " sin ",
        " sobre ",
        " entre ",
        " hacia ",
        " desde ",
        " durante ",
        // Pronouns - more distinctive
        " yo ",
        " tú ",
        " mí ",
        " ti ",
        " me ",
        " te ",
        " se ",
        " nos ",
        " os ",
        // Verbs (present indicative) - highly distinctive
        " soy ",
        " eres ",
        " es ",
        " somos ",
        " están ",
        " estoy ",
        " estás ",
        " está ",
        " tengo ",
        " tienes ",
        " tiene ",
        " tenemos ",
        " tienen ",
        " voy ",
        " vas ",
        " va ",
        " vamos ",
        " van ",
        " quiero ",
        " quieres ",
        " quiere ",
        " queremos ",
        " quieren ",
        " puedo ",
        " puedes ",
        " puede ",
        " podemos ",
        " pueden ",
        " hacer ",
        " ver ",
        " dar ",
        " saber ",
        " conocer ",
        // Common connectors
        " que ",
        " pero ",
        " porque ",
        " aunque ",
        " cuando ",
        " donde ",
        " como ",
        " cual ",
        " cuál ",
        // Question words
        " qué ",
        " quién ",
        " cuándo ",
        " dónde ",
        " cómo ",
        " por qué ",
        " para qué ",
        // Highly distinctive Spanish words
        " muy ",
        " mucho ",
        " mucho ",
        " bien ",
        " también ",
        " nada ",
        " algo ",
        " todo ",
        " ahora ",
        " después ",
        " siempre ",
        " nunca ",
        " solo ",
        " solamente ",
        " entonces ",
        " además ",
        " mejor ",
        " peor ",
        " gran ",
        " buena ",
        " bueno ",
        " debe ",
        " deben ",
        " haber ",
        " ha ",
        " han ",
        " he ",
        " han ",
        // Time expressions
        " hoy ",
        " ayer ",
        " mañana ",
        " ahora ",
        " antes ",
        " después ",
        " tiempo ",
        " vez ",
        // Other common words
        " más ",
        " menos ",
        " tanto ",
        " tan ",
        " muy ",
        " ese ",
        " esa ",
        " eso ",
        " esto ",
        " esto ",
        " este ",
        " esta ",
        " esto ",
        " esto ",
        " mi ",
        " mis ",
        " tu ",
        " tus ",
        " su ",
        " sus ",
        " nuestro ",
        " nuestros ",
        " nuestra ",
        " nuestras ",
      ],
    },
    {
      code: "fr",
      label: "French",
      // Common French chars that are relatively unique or high frequency
      pattern: /[àâçèêëîïôûùœæ]/i,
      keywords: [
        // Definite articles - highly distinctive
        " le ",
        " la ",
        " les ",
        " l'",
        // Indefinite articles
        " un ",
        " une ",
        " des ",
        " du ",
        " de la ",
        " d'",
        // Prepositions - distinctive
        " à ",
        " au ",
        " aux ",
        " de ",
        " du ",
        " des ",
        " en ",
        " dans ",
        " sur ",
        " sous ",
        " pour ",
        " par ",
        " avec ",
        " sans ",
        " chez ",
        // Conjunctions
        " et ",
        " ou ",
        " mais ",
        " donc ",
        " or ",
        " ni ",
        " car ",
        // Pronouns - highly distinctive
        " je ",
        " j'",
        " tu ",
        " il ",
        " elle ",
        " nous ",
        " vous ",
        " ils ",
        " elles ",
        " moi ",
        " toi ",
        " lui ",
        " eux ",
        " leur ",
        " leurs ",
        " se ",
        " y ",
        " en ",
        // Verbs (present) - highly distinctive
        " suis ",
        " es ",
        " est ",
        " sommes ",
        " êtes ",
        " sont ",
        " ai ",
        " as ",
        " a ",
        " avons ",
        " avez ",
        " ont ",
        " vais ",
        " vas ",
        " va ",
        " allons ",
        " allez ",
        " vont ",
        " veux ",
        " veux ",
        " veut ",
        " voulons ",
        " voulez ",
        " veulent ",
        " peux ",
        " peux ",
        " peut ",
        " pouvons ",
        " pouvez ",
        " peuvent ",
        " faire ",
        " dire ",
        " voir ",
        " savoir ",
        " connaître ",
        // Question words
        " que ",
        " qui ",
        " quoi ",
        " où ",
        " quand ",
        " comment ",
        " pourquoi ",
        " combien ",
        " quel ",
        " quelle ",
        " quels ",
        " quelles ",
        // Common words
        " très ",
        " trop ",
        " pas ",
        " plus ",
        " moins ",
        " bien ",
        " mal ",
        " oui ",
        " non ",
        " peut-être ",
        " alors ",
        " donc ",
        " bon ",
        " bonne ",
        " grand ",
        " grande ",
        " petit ",
        " petite ",
        " nouveau ",
        " nouvelle ",
        " autre ",
        " mêmes ",
        " sans ",
        " seulement ",
        " aussi ",
        // Time
        " aujourd'hui ",
        " hier ",
        " demain ",
        " maintenant ",
        " souvent ",
        " toujours ",
        " jamais ",
        " parfois ",
        " temps ",
        " fois ",
        // Possessives
        " mon ",
        " ma ",
        " mes ",
        " ton ",
        " ta ",
        " tes ",
        " son ",
        " sa ",
        " ses ",
        " notre ",
        " nos ",
        " votre ",
        " vos ",
        " leur ",
        " leurs ",
      ],
    },
    {
      code: "it",
      label: "Italian",
      pattern: /[àèéìíîòóù]/i, // Italian vowels with accents
      keywords: [
        // Definite articles - highly distinctive
        " il ",
        " lo ",
        " la ",
        " le ",
        " i ",
        " gli ",
        // Indefinite articles
        " un ",
        " uno ",
        " una ",
        " un'",
        // Prepositions - distinctive
        " di ",
        " a ",
        " da ",
        " in ",
        " su ",
        " per ",
        " con ",
        " senza ",
        " da ",
        " fra ",
        " tra ",
        // Conjunctions
        " e ",
        " ed ",
        " o ",
        " ma ",
        " però ",
        " quindi ",
        " perché ",
        " se ",
        " anche ",
        " che ",
        // Pronouns - highly distinctive
        " io ",
        " tu ",
        " lui ",
        " lei ",
        " noi ",
        " voi ",
        " loro ",
        " me ",
        " ti ",
        " ci ",
        " vi ",
        " si ",
        // Verbs (present) - highly distinctive
        " sono ",
        " sei ",
        " è ",
        " siamo ",
        " siete ",
        " ho ",
        " hai ",
        " ha ",
        " abbiamo ",
        " avete ",
        " hanno ",
        " vado ",
        " vai ",
        " va ",
        " andiamo ",
        " andate ",
        " vanno ",
        " voglio ",
        " vuoi ",
        " vuole ",
        " vogliamo ",
        " volete ",
        " vogliono ",
        " posso ",
        " puoi ",
        " può ",
        " possiamo ",
        " potete ",
        " possono ",
        " fare ",
        " dire ",
        " vedere ",
        " sapere ",
        // Question words
        " che ",
        " chi ",
        " cosa ",
        " dove ",
        " quando ",
        " come ",
        " perché ",
        " quanto ",
        " quale ",
        " quali ",
        // Common words - distinctive
        " molto ",
        " poco ",
        " troppo ",
        " bene ",
        " male ",
        " sì ",
        " no ",
        " allora ",
        " quindi ",
        " anche ",
        " ancora ",
        " sempre ",
        " mai ",
        " quasi ",
        " proprio ",
        " solo ",
        " solamente ",
        " così ",
        " dove ",
        " come ",
        " quanto ",
        // Time
        " oggi ",
        "ieri ",
        " domani ",
        " adesso ",
        " ora ",
        " tempo ",
        " volta ",
        " volte ",
        // Possessives
        " il mio ",
        " la mia ",
        " i miei ",
        " le mie ",
        " il tuo ",
        " la tua ",
        " i tuoi ",
        " le tue ",
        " il suo ",
        " la sua ",
        " i suoi ",
        " le sue ",
        " il nostro ",
        " la nostra ",
        " i nostri ",
        " le nostre ",
        " il vostro ",
        " la vostra ",
        " i vostri ",
        " le vostre ",
        " il loro ",
        " la loro ",
        " i loro ",
        " le loro ",
        // Other distinctive Italian words
        " questo ",
        " questa ",
        " questi ",
        " queste ",
        " quello ",
        " quella ",
        " quelli ",
        " quelle ",
        " tutto ",
        " tutta ",
        " tutti ",
        " tutte ",
        " qualche ",
        " qualcuno ",
        " qualcosa ",
        " niente ",
        " nulla ",
        " nessuno ",
        " nessuna ",
        " essere ",
        " avere ",
        " fare ",
        " andare ",
      ],
    },
    {
      code: "ru",
      label: "Russian",
      pattern: /[а-яё]/i,
      keywords: [],
    },
    {
      code: "zh",
      label: "Chinese",
      pattern: /[\u4e00-\u9fff]/,
      keywords: [],
    },
    {
      code: "ja",
      label: "Japanese",
      pattern: /[\u3040-\u30ff]/,
      keywords: [],
    },
    {
      code: "ko",
      label: "Korean",
      pattern: /[\uac00-\ud7af]/,
      keywords: [],
    },
    {
      code: "ar",
      label: "Arabic",
      pattern: /[\u0600-\u06ff]/,
      keywords: [],
    },
    {
      code: "en",
      label: "English",
      keywords: [
        " the ",
        " of ",
        " and ",
        " a ",
        " to ",
        " in ",
        " is ",
        " you ",
        " that ",
        " it ",
        " he ",
        " was ",
        " for ",
        " on ",
        " are ",
        " as ",
        " with ",
        " his ",
        " they ",
        " I ",
      ],
    },
  ];

function detectLanguageFromText(
  text: string | null | undefined
): DetectedLanguage | null {
  if (!text) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  // Normalize: lower case and padded with spaces to match whole words in keywords
  const normalized = ` ${trimmed.toLowerCase()} `;

  let bestMatch: DetectedLanguage | null = null;
  let maxScore = 0;

  // Define high-value distinctive keywords (highly unique verbs and words)
  const HIGH_VALUE_KEYWORDS = new Set([
    // German - verbs and highly distinctive words (NEW)
    "ich", "du", "er", "sie", "wir", "bin", "bist", "ist", "sind",
    "habe", "hast", "hat", "haben", "kann", "kannst", "können",
    "will", "willst", "wollen", "mache", "machst", "macht",
    "nicht", "auch", "schon", "doch", "mal", "wirklich", "eigentlich",
    // Spanish - verbs and highly distinctive words
    "soy", "estoy", "estas", "está", "tengo", "tienes", "tiene", "vamos", "van", "quiero", "quieres", "puedo", "puedes",
    "muy", "también", "nada", "siempre", "nunca", "solo", "entonces", "además", "hoy", "mañana",
    // French - verbs and highly distinctive words
    "suis", "es", "est", "sommes", "êtes", "sont", "ai", "as", "a", "avons", "avez", "ont",
    "très", "pas", "plus", "oui", "non", "alors", "donc", "aujourd'hui", "maintenant", "toujours", "jamais",
    // Italian - verbs and highly distinctive words
    "sono", "sei", "è", "siamo", "siete", "ho", "hai", "ha", "abbiamo", "avete", "hanno",
    "molto", "sì", "allora", "quindi", "anche", "ancora", "sempre", "mai", "proprio", "così",
    // English - highly distinctive words
    "the", "of", "and", "am", "is", "are", "was", "were", "have", "has", "had", "will", "would", "could",
  ]);

  // Sort languages by priority (higher priority checked first)
  const sortedLanguages = [...LANGUAGE_HEURISTICS].sort((a, b) => {
    const priorityA = a.priority || 0;
    const priorityB = b.priority || 0;
    return priorityB - priorityA;
  });

  for (const rule of sortedLanguages) {
    let score = 0;
    let highValueMatches = 0;
    let normalMatches = 0;

    // 1. Check unique character patterns (highest weight - these are unambiguous)
    if (rule.pattern) {
      const matches = trimmed.match(new RegExp(rule.pattern, "gi"));
      if (matches) {
        // Unique characters like ¿, ¡, ñ for Spanish, ä, ö, ü for German get high weight
        score += matches.length * 5;
      }
    }

    // 2. Check keywords with weighted scoring
    if (rule.keywords && rule.keywords.length > 0) {
      for (const keyword of rule.keywords) {
        if (normalized.includes(keyword)) {
          // Extract the word without spaces for checking
          const word = keyword.trim();

          // High-value keywords (unique verbs, distinctive words) get 3 points
          if (HIGH_VALUE_KEYWORDS.has(word)) {
            highValueMatches += 3;
          } else {
            // Regular keywords (articles, prepositions) get 1 point
            normalMatches += 1;
          }
        }
      }
    }

    // 3. Add keyword scores to total
    score += highValueMatches + normalMatches;

    // 4. Language-specific boosts
    if (rule.code === "es") {
      // Boost for Spanish-specific combinations that reduce false positives
      if (normalized.includes(" de el ") || normalized.includes(" de la ") ||
        normalized.includes(" que el ") || normalized.includes(" que la ")) {
        score += 2; // These are common contractions/structures in Spanish
      }
    }

    // 5. For scripts like Chinese/Russian where pattern is entire content
    if (
      ["ru", "zh", "ja", "ko", "ar"].includes(rule.code) &&
      rule.pattern &&
      rule.pattern.test(trimmed)
    ) {
      score += 20; // Higher boost for unique scripts
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = { code: rule.code, label: rule.label };
    }
  }

  // Return the best match if score is significant enough
  // Lower threshold for better detection (was > 0, now > 0 but with better scoring)
  if (maxScore > 0) {
    return bestMatch;
  }

  return null;
}

/**
 * Estimate token count for text (rough approximation)
 * Note: This is a simple approximation. For accurate counts, use tiktoken or similar.
 */
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Rough approximation: ~4 characters per token for English
  // This varies by language but is a reasonable baseline
  return Math.ceil(text.length / 4);
}

/**
 * Extract features used from the request
 */
function extractFeaturesUsed(
  hasRag: boolean,
  webSearchEnabled: boolean,
  hasImages: boolean,
  hasReasoning: boolean
): string[] {
  const features: string[] = [];
  if (hasRag) features.push('rag');
  if (webSearchEnabled) features.push('web_search');
  if (hasImages) features.push('vision');
  if (hasReasoning) features.push('reasoning');
  return features;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check Rate Limit (100 per hour)
  const { success } = await chatRateLimiter.check(user.id, 100);
  if (!success) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { id: conversationId } = await params;
  const userEmail = (user as any).primaryEmail || "";

  try {
    // Check if it's a UUID or slug
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        conversationId
      );
    const conversation = isUUID
      ? await getConversation(conversationId, userEmail)
      : await getConversationBySlug(conversationId, userEmail);

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const {
      content,
      systemPrompt: customSystemPrompt,
      webSearchEnabled,
      provider: requestProvider,
      model: requestModel,
      images,
    } = body;

    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "Content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Add user message - use actual conversation ID from database
    const userMessage = await addMessage({
      conversationId: conversation.id,
      role: "user",
      content,
      metadata: {},
      images: images as any, // Store images in the message
    });

    // Get RAG context from multiple sources
    let ragContext = "";
    let sources: Array<{
      id?: string;
      documentId?: string;
      chunkId?: string;
      filename: string;
      content: string;
      score: number;
      metadata?: any;
    }> = [];

    // Web search context
    let webSearchContext = "";
    let webSources: Array<{
      url: string;
      title: string;
      snippet: string;
      source: string;
    }> = [];

    // 0. Get web search context if enabled
    if (webSearchEnabled) {
      try {
        const internalUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
        const searchResponse = await fetch(`${internalUrl}/api/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("Cookie") || "",
          },
          body: JSON.stringify({
            query: content,
            limit: 5,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.success && searchData.results?.length > 0) {
            webSources = searchData.results.map((r: any) => ({
              url: r.url,
              title: r.title,
              snippet: r.snippet,
              source: r.source,
            }));

            webSearchContext = searchData.results
              .map(
                (r: any) =>
                  `[Web Source: ${r.title}]\nURL: ${r.url}\n${r.snippet}`
              )
              .join("\n\n---\n\n");

          }
        } else {
          console.error("❌ Web search failed:", await searchResponse.text());
        }
      } catch (error) {
        console.error("💥 [Chat Stream] Web search error:", error);
      }
    }

    // 1. Get context from uploaded documents in this conversation
    try {
      // Use internal URL to avoid SSL issues with self-signed certs
      const internalUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
      const searchUrl = `${internalUrl}/api/chat/documents/search?conversationId=${conversation.id}&query=${encodeURIComponent(content)}`;
      const chatDocsResponse = await fetch(searchUrl, {
        method: "GET",
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      });

      if (chatDocsResponse.ok) {
        const chatDocsData = await chatDocsResponse.json();
        if (
          chatDocsData.success &&
          chatDocsData.results &&
          chatDocsData.results.length > 0
        ) {
          const chatDocSources = chatDocsData.results
            .slice(0, 3)
            .map((r: any) => ({
              filename: r.filename || "Uploaded Document",
              content: r.chunk_text,
              score: r.similarity || 1,
            }));
          sources.push(...chatDocSources);

          const chatDocsContext = chatDocsData.results
            .slice(0, 3)
            .map(
              (result: any) =>
                `Dokument: ${result.filename || "Hochgeladenes Dokument"
                }\nInhalt: ${result.chunk_text}`
            )
            .join("\n\n---\n\n");

          if (chatDocsContext) {
            ragContext += chatDocsContext;
          }
        } else {
        }
      } else {
        console.error(
          "❌ Chat docs response not OK:",
          await chatDocsResponse.text()
        );
      }
    } catch (error) {
      console.error("💥 [Chat Stream] Error fetching chat documents:", error);
    }

    // 2. Get context from RAG packages
    if (conversation.ragPackageIds && conversation.ragPackageIds.length > 0) {
      try {
        const internalUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
        const ragResponse = await fetch(`${internalUrl}/api/rag/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("Cookie") || "",
          },
          body: JSON.stringify({
            query: content,
            packageIds: conversation.ragPackageIds,
            limit: 10,
          }),
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();

          if (
            ragData.success &&
            ragData.results &&
            ragData.results.length > 0
          ) {
            const results = ragData.results.slice(0, 5);
            const ragPackageSources = results.map((r: any) => ({
              id:
                r.id ||
                `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              documentId: r.document_id, // Ensure your RAG API returns this
              chunkId: r.id,
              filename: r.metadata?.filename || "Documento",
              content: r.content,
              score: r.score,
              metadata: r.metadata,
            }));
            sources.push(...ragPackageSources);

            const ragPackageContext = results
              .map(
                (result: any) =>
                  `Documento: ${result.metadata?.filename || "Sin nombre"
                  }\nContenido: ${result.content}`
              )
              .join("\n\n---\n\n");

            if (ragPackageContext) {
              if (ragContext) ragContext += "\n\n---\n\n";
              ragContext += ragPackageContext;
            }
          }
        }
      } catch (error) {
        console.error("[Chat Stream] Error fetching RAG packages:", error);
      }
    }

    // Get conversation history for context
    const recentMessages = conversation.messages?.slice(-6) || []; // Last 6 messages (3 exchanges)
    const conversationHistory = recentMessages
      .map(
        (msg) =>
          `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
      )
      .join("\n\n");

    // Variables to store final model info for saving in message metadata
    let finalProvider: AIProvider = conversation.provider;
    let finalModel = conversation.model;
    let finalModelName: string | undefined;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Determine which model to use
          // Priority: 1. Request body values, 2. Smart selector, 3. Conversation defaults
          let selectedProvider: AIProvider = conversation.provider;
          let selectedModel = conversation.model;
          let smartSelectorReason: string | undefined;
          const useSmartSelector =
            requestProvider === "auto" || requestModel === "auto";

          // If provider/model specified in request, use those
          if (requestProvider && requestProvider !== "auto") {
            selectedProvider = requestProvider as AIProvider;
          }
          if (requestModel && requestModel !== "auto") {
            selectedModel = requestModel;
          }

          // If smart selector is enabled (either from request or conversation setting)
          if (useSmartSelector || conversation.useSmartSelector) {
            const recommendation = getRecommendedModel(
              content,
              selectedProvider
            );
            selectedProvider = recommendation.provider;
            selectedModel = recommendation.model;
            smartSelectorReason = recommendation.reason;

          }

          // Get model info for logging
          const modelInfo = getModel(selectedProvider, selectedModel);
          // Track start time for usage analytics
          const startTime = Date.now();

          // Send smart selector info if applicable
          if (smartSelectorReason) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "smart-selector",
                  provider: selectedProvider,
                  model: selectedModel,
                  modelName: modelInfo?.name,
                  reason: smartSelectorReason,
                })}\n\n`
              )
            );
          }

          // Determine language strategy
          const rawUser = user as any;

          // Debug user metadata
          const userPreferences =
            rawUser.clientMetadata?.preferences ||
            rawUser.serverMetadata?.preferences;
          const userLanguagePref = userPreferences?.language;

          // 1. Detect language from the current message
          const detectedLanguage = detectLanguageFromText(content);

          // 2. Resolve final target language
          // Priority: Detected > User Preference > Default (English)
          let targetLanguage = "English";
          let targetLanguageCode = "en";

          if (detectedLanguage) {
            targetLanguage = detectedLanguage.label;
            targetLanguageCode = detectedLanguage.code;
          } else if (userLanguagePref) {
            const pref = LANGUAGE_HEURISTICS.find(
              (l) => l.code === userLanguagePref
            );
            if (pref) {
              targetLanguage = pref.label;
              targetLanguageCode = pref.code;
            }
          }

          const currentDate = new Date().toLocaleDateString(
            targetLanguageCode,
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
          );

          // Use custom system prompt if provided (from assistant), otherwise use default
          const systemPrompt =
            customSystemPrompt ||
            `You are a helpful assistant that answers questions using the documents provided and the conversation history.

Current Date: ${currentDate}

CRITICAL LANGUAGE INSTRUCTION:
You MUST respond in ${targetLanguage} (${targetLanguageCode}). This is a non-negotiable requirement.
- Do NOT respond in English unless ${targetLanguageCode} is 'en'
- Do NOT respond in Spanish unless ${targetLanguageCode} is 'es'
- Do NOT respond in German unless ${targetLanguageCode} is 'de'
- Even if documents or context are in a different language, you must translate your response to ${targetLanguage}
- If the user's message is in a different language, acknowledge it but still respond in ${targetLanguage}

Your job:
1. Review the supplied documents.
2. Consider the previous conversation context.
3. Answer the user's question clearly, with a structured and conversational tone.
4. When appropriate, cite sources in the format: [Source: file_name].
5. If the information is not present in the documents, state that explicitly.
6. Use Markdown formatting (headings, lists, emphasis) to improve readability.
7. ALWAYS respond in ${targetLanguage} - this is your highest priority.`;

          const languageInstruction = {
            role: "system" as const,
            content: `MANDATORY LANGUAGE REQUIREMENT: You must respond in ${targetLanguage} (${targetLanguageCode}).

Rules:
1. ALWAYS respond in ${targetLanguage}, regardless of the user's message language
2. If documents are in another language, translate the information to ${targetLanguage}
3. If the user writes in a different language, acknowledge their message but respond in ${targetLanguage}
4. NEVER switch languages mid-response
5. This is a critical requirement - failing to respond in ${targetLanguage} is a failure to follow instructions.

Examples:
- User (in Spanish): "What is the capital of France?"
- Your response: "La capital de Francia es París." (in Spanish)

- User (in German): "How do I bake a cake?"
- Your response: "Para hornear un pastel, necesitas..." (in Spanish, if Spanish is the target language)`,
          };

          // Print debug info for language logic
          // Combine all context sources
          const allContext = [webSearchContext, ragContext]
            .filter(Boolean)
            .join("\n\n===\n\n");

          const userPrompt = allContext
            ? `Previous conversation context:
${conversationHistory || "(no prior messages provided)"}

Current user question: ${content}

${webSearchContext ? "Web search results:\n" + webSearchContext + "\n\n" : ""}${ragContext ? "Available documents:\n" + ragContext : ""}

INSTRUCTIONS: Answer the user's question using the information provided and the conversation context. When citing web sources, include the source URL.

CRITICAL: You MUST respond in ${targetLanguage} (${targetLanguageCode}). This is required - do not respond in any other language.`
            : `Previous conversation context:
${conversationHistory || "(no prior messages provided)"}

Current user question: ${content}

No documents or web results are available for this conversation. Please answer based on your general knowledge and the conversation context.

CRITICAL: You MUST respond in ${targetLanguage} (${targetLanguageCode}). This is required - do not respond in any other language.`;

          // Use provider abstraction to call the appropriate API
          let llmResponse: Response;
          try {
            llmResponse = await streamChatCompletion(selectedProvider, {
              model: selectedModel,
              messages: [
                {
                  role: "system",
                  content: `${systemPrompt}

    REMINDER: You MUST respond in ${targetLanguage} (${targetLanguageCode}). This is your highest priority.
Current Date: ${new Date().toLocaleDateString(targetLanguageCode, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                    }.
    `,
                },
                languageInstruction,
                {
                  role: "user",
                  content: userPrompt,
                  // Include images if present and provider supports vision
                  ...(images && images.length > 0 && (selectedProvider === 'openai' || selectedProvider === 'anthropic')
                    ? { images: images as Array<{ dataUrl: string; type: string; name: string }> }
                    : {}
                  ),
                },
              ],
              temperature: 0.3,
              maxTokens: 1500,
              topP: 1,
              topK: 50,
              stream: true,
            });
          } catch (providerError) {
            console.error(
              "❌ Provider error, falling back to OpenAI:",
              providerError
            );

            // Fallback to OpenAI if the selected provider fails
            if (selectedProvider !== "openai") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "warning",
                    message: `${selectedProvider} is not available. Falling back to OpenAI.`,
                  })
                  } \n\n`
                )
              );

              selectedProvider = "openai";
              selectedModel = "gpt-4o-mini";

              llmResponse = await streamChatCompletion("openai", {
                model: selectedModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  languageInstruction,
                  { role: "user", content: userPrompt },
                ],
                temperature: 0.3,
                maxTokens: 1500,
                topP: 1,
                topK: 50,
                stream: true,
              });
            } else {
              throw providerError;
            }
          }

          if (!llmResponse.ok || !llmResponse.body) {
            controller.enqueue(
              encoder.encode('data: {"error": "LLM request failed"}\n\n')
            );
            controller.close();
            return;
          }

          let fullResponse = "";
          let reasoning = "";
          const reader = llmResponse.body.getReader();
          const decoder = new TextDecoder();

          const hasReasoning = isReasoningModel(selectedModel);

          // Store final model info for message metadata
          finalProvider = selectedProvider;
          finalModel = selectedModel;
          finalModelName = getModelDisplayName(selectedModel, selectedProvider);

          // Send model info first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "model-info",
                provider: selectedProvider,
                model: selectedModel,
                modelName: finalModelName,
                hasReasoning,
              })
              } \n\n`
            )
          );

          // Send sources first
          if (sources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "sources",
                  sources: sources.map((s) => ({
                    id: s.id,
                    documentId: s.documentId,
                    filename: s.filename,
                    preview: s.content.substring(0, 150) + "...",
                    content: s.content, // Full content for highlight
                    score: s.score,
                    metadata: s.metadata,
                  })),
                })
                } \n\n`
              )
            );
          }

          // Send web sources
          if (webSources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "web-sources",
                  sources: webSources,
                })
                } \n\n`
              )
            );
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk
              .split("\n")
              .filter((line) => line.trim() !== "");

            const isAnthropic = isAnthropicProvider(selectedProvider);

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  if (isAnthropic) {
                    // Anthropic format
                    const type = parsed.type;

                    if (type === 'content_block_delta') {
                      const delta = parsed.delta;
                      const text = delta?.text;

                      if (text) {
                        fullResponse += text;
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({
                              type: "content",
                              content: text,
                            })
                            } \n\n`
                          )
                        );
                      }
                    } else if (type === 'content_block_stop' || type === 'message_stop') {
                      // Stream end events - no action needed
                      continue;
                    } else if (type === 'ping') {
                      // Heartbeat - ignore
                      continue;
                    }
                  } else {
                    // OpenAI format (and other compatible providers)
                    const delta = parsed.choices?.[0]?.delta;
                    const content = delta?.content;

                    // Check for reasoning content (OpenAI o1 models)
                    const reasoningContent = delta?.reasoning_content || delta?.reasoning;

                    if (reasoningContent && hasReasoning) {
                      reasoning += reasoningContent;
                      // Send reasoning as a separate event type
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "reasoning",
                            content: reasoningContent,
                          })
                          } \n\n`
                        )
                      );
                    } else if (content) {
                      fullResponse += content;
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "content",
                            content,
                          })
                          } \n\n`
                        )
                      );
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Save assistant message
          const savedMessage = await addMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: fullResponse,
            metadata: {
              model: finalModel,
              modelName: finalModelName,
              provider: finalProvider,
              ragContext: ragContext || undefined,
              ragPackageIds: conversation.ragPackageIds,
              searchQuery: content,
              sources: sources.length > 0 ? sources : undefined,
              webSources: webSources.length > 0 ? webSources : undefined,
            },
          });

          // Calculate response time
          const responseTimeMs = Date.now() - startTime;

          // Audit Log: Chat Query
          await logAudit({
            action: "CHAT_QUERY",
            userId: user.id,
            teamSlug: conversation.teamSlug, // Ensure teamSlug is available on conversation object
            targetType: "chat_conversation",
            targetId: conversation.id,
            metadata: {
              model: selectedModel,
              provider: selectedProvider,
              messageLength: content.length,
              responseLength: fullResponse.length,
              ragEnabled:
                conversation.ragPackageIds &&
                conversation.ragPackageIds.length > 0,
              webSearchEnabled: webSearchEnabled,
            },
          });

          // AI Usage Tracking - log token usage and costs
          try {
            const requestTokens = estimateTokenCount(userPrompt);
            const responseTokens = estimateTokenCount(fullResponse);
            const hasRag = !!(conversation.ragPackageIds && conversation.ragPackageIds.length > 0);
            const hasImages = !!(images && images.length > 0);
            const hasReasoning = isReasoningModel(selectedModel);

            const featuresUsed = extractFeaturesUsed(hasRag, webSearchEnabled || false, hasImages, hasReasoning);

            await logAiUsage({
              teamSlug: conversation.teamSlug,
              userEmail: userEmail || 'unknown',
              conversationId: conversation.id,
              messageId: savedMessage.id,
              provider: selectedProvider,
              model: selectedModel,
              requestTokens,
              responseTokens,
              featuresUsed,
              responseTimeMs,
            });
          } catch (usageError) {
            // Don't fail the request if usage tracking fails
            console.error("⚠️ [Usage Tracking] Failed to log usage:", usageError);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                messageId: savedMessage.id,
              })
              } \n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("💥 [Chat Stream] Critical Error:", error);
          console.error(
            "Stack trace:",
            error instanceof Error ? error.stack : "No stack trace"
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              })
              } \n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat Stream] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process query",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

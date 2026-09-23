import { getPackageById } from '@/lib/rag/store';
import { searchQdrant } from '@/lib/rag/qdrant';
import {
  buildBM25Index,
  searchBM25,
  chunkToBM25Document,
  bm25ResultToRetrievedChunk,
  type BM25Index,
  type BM25Result,
} from '@/lib/rag/bm25';

export type RewriterOutput = {
  best: string;
};

// Cache simple para evitar reescribir la misma consulta múltiples veces
const rewriteCache = new Map<string, { result: RewriterOutput; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_SIZE = 100; // Máximo de entradas en caché

// Limpieza periódica del caché (ejecutar cada 10 minutos)
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  const keysToDelete: string[] = [];

  rewriteCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => {
    rewriteCache.delete(key);
    removed++;
  });

  if (removed > 0) {
    console.log('[Query Rewriter] Cache cleanup', { removed });
  }

  // Si aún excede el límite, eliminar las más antiguas
  if (rewriteCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(rewriteCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => rewriteCache.delete(key));
  }
}, 10 * 60 * 1000);

export type RetrievedChunk = {
  packageId: string;
  packageName?: string;
  documentId?: string;
  filename?: string;
  text?: string;
  score: number;
};

export function normalizeQuery(text: string): string {
  const t = (text || '').normalize('NFKC').trim();
  // normaliza espacios y quita comillas raras
  return t.replace(/[\u201C\u201D\u2018\u2019]/g, '"').replace(/[\s\u00A0]+/g, ' ');
}

export async function rewriteQuery(original: string): Promise<RewriterOutput> {
  const startTime = Date.now();
  // Verificar caché primero
  const cached = rewriteCache.get(original);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.debug('[Query Rewriter] Cache hit', {
      age: ((Date.now() - cached.timestamp) / 1000) + 's'
    });
    return cached.result;
  }

  const base: RewriterOutput = { best: original };
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const provider = process.env.EMBEDDING_PROVIDER || 'openai';

  // Pequeña heurística local si no hay API
  if (!apiKey) {
    const best = original
      .replace(/\s+/g, ' ')
      .replace(/\?+/g, '?')
      .trim();
    const result = { best };
    console.debug('[Query Rewriter] Local rewrite result', {
      duration: Date.now() - startTime
    });
    rewriteCache.set(original, { result, timestamp: Date.now() });
    return result;
  }

  try {
    const prompt = `Optimiere diese Frage für eine semantische Dokumentensuche. Extrahiere die wichtigsten Suchbegriffe und formuliere eine präzise Suchanfrage mit relevanten Schlüsselwörtern.

Beispiele:
- "Wer eignet sich am besten für die Stelle Vertrieb?" → "Vertrieb Verkauf Erfahrung Position Qualifikation Kenntnisse Kundenbetreuung Verkaufsziele"
- "Welcher Kandidat hat Python-Kenntnisse?" → "Python Programmierung Entwicklung Kenntnisse Erfahrung Projekte Software"
- "Was steht im Vertrag über Kündigungsfristen?" → "Vertrag Kündigungsfrist Kündigung Frist Regelung Bedingungen"
- "Wie funktioniert die Rückgabepolitik?" → "Rückgabe Rückgabepolitik Umtausch Rücksendung Bedingungen Frist"
- "Welche Funktionen hat das Produkt?" → "Funktionen Features Eigenschaften Leistung Merkmale Spezifikationen"

Frage: ${original}

Gib nur JSON zurück mit {"best":string}. Die "best" Antwort sollte eine optimierte Suchanfrage mit relevanten Schlüsselwörtern sein (5-8 Begriffe).`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.REWRITER_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du bist ein Experte für Suchoptimierung. Wandle Fragen in präzise Suchanfragen um, die wichtige Schlüsselwörter enthalten. Korrigiere Rechtschreibfehler und gib gültiges JSON zurück.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error('[Query Rewriter] OpenAI API error', {
        status: res.status,
        statusText: res.statusText
      });
      return base;
    }

    const data = await res.json().catch(() => undefined);
    const content: string | undefined = data?.choices?.[0]?.message?.content;

    console.debug('[Query Rewriter] OpenAI API duration', {
      duration: Date.now() - startTime
    });

    if (!content) {
      console.warn('[Query Rewriter] No content in response');
      return base;
    }

    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      const best = String(parsed.best || original);

      console.debug('[Query Rewriter] Parse success', {
        duration: Date.now() - startTime
      });

      const result = { best };
      rewriteCache.set(original, { result, timestamp: Date.now() });
      return result;
    } else {
      console.warn('[Query Rewriter] No valid JSON found in response');
    }
  } catch (error) {
    console.error('[Query Rewriter] Error', {
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    });
  }

  console.debug('[Query Rewriter] Fallback to original', {
    duration: Date.now() - startTime
  });
  rewriteCache.set(original, { result: base, timestamp: Date.now() });
  return base;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    // Fallback no-embed: retorna vectores unitarios aleatorios (solo para no romper)
    console.warn('[EmbedTexts] No API key, using fallback vectors');
    return texts.map((_, i) => Array.from({ length: Number(process.env.QDRANT_VECTOR_SIZE || 3072) }, (_, j) => (j === i % 8 ? 1 : 0)));
  }

  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  console.debug('[EmbedTexts] Batch embedding', {
    count: texts.length,
    totalChars,
    avgChars: Math.round(totalChars / texts.length)
  });

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    console.error('[EmbedTexts] OpenAI API error', {
      status: res.status,
      statusText: res.statusText,
      error: errorText
    });
    throw new Error(`OpenAI embedding API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data?.data || !Array.isArray(data.data)) {
    console.error('[EmbedTexts] Invalid response structure', { data });
    throw new Error('Invalid embedding response structure');
  }

  // Sort by index to ensure correct order (OpenAI may return out of order)
  const sortedData = [...data.data].sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
  const vectors = sortedData.map((d: any) => d.embedding as number[]);

  if (vectors.length !== texts.length) {
    console.error('[EmbedTexts] Vector count mismatch', {
      expected: texts.length,
      received: vectors.length
    });
    throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${vectors.length}`);
  }

  return vectors;
}

export async function retrieveFromQdrant(params: {
  teamSlug: string;
  packageIds: string[];
  queries: string[]; // optimized + variants
}): Promise<RetrievedChunk[]> {
  const { teamSlug, packageIds, queries } = params;

  if (packageIds.length === 0) {
    console.warn('[Qdrant Retrieve] No package IDs provided');
    return [];
  }

  // Obtén collections por paquete
  const collections: { packageId: string; packageName?: string; collectionName: string }[] = [];
  const validDocIdsByPackage: Map<string, Set<string>> = new Map();
  for (const pid of packageIds) {
    const pkg = await getPackageById(pid, true); // includeDeleted = true para buscar TODOS los documentos
    if (pkg) {
      console.debug('[Qdrant Retrieve] Found package', {
        packageId: pid,
        collectionName: pkg.collectionName,
        docCount: pkg.documents?.length || 0
      });
      collections.push({ packageId: pid, packageName: pkg.name, collectionName: pkg.collectionName });
      const ids = new Set<string>((pkg.documents || []).map((d) => d.id));
      validDocIdsByPackage.set(pid, ids);
    } else {
      console.warn('[Qdrant Retrieve] Package not found', { packageId: pid });
    }
  }

  if (collections.length === 0) {
    console.warn('[Qdrant Retrieve] No valid collections found');
    return [];
  }

  console.debug('[Qdrant Retrieve] Collections to search', {
    count: collections.length,
    validDocIds: Array.from(validDocIdsByPackage.entries()).map(([pid, ids]) => ({
      packageId: pid,
      count: ids.size
    }))
  });

  // Embeddings de consultas
  const vectors = await embedTexts(queries);
  type Scored = RetrievedChunk & { rank: number };
  const perQueryLists: Scored[][] = [];

  for (let qi = 0; qi < vectors.length; qi++) {
    const vec = vectors[qi];
    const aggregated: Scored[] = [];

    for (const c of collections) {
      try {
        const hits = await searchQdrant(c.collectionName, vec, 50, {
          must: [
            { key: 'team_slug', match: { value: teamSlug } },
            { key: 'packageId', match: { value: c.packageId } },
          ],
        });

        console.debug('[Qdrant Retrieve] Search results', {
          collectionName: c.collectionName,
          hitsCount: hits.length,
          topScores: hits.slice(0, 3).map(h => ({
            score: h.score,
            documentId: h.payload?.documentId,
            filename: h.payload?.filename,
            textPreview: String(h.payload?.text || '').substring(0, 100)
          }))
        });

        const validIds = validDocIdsByPackage.get(c.packageId) || new Set<string>();
        console.debug('[Qdrant Retrieve] Valid doc IDs', {
          packageId: c.packageId,
          validCount: validIds.size,
          hitsCount: hits.length
        });

        let rankCounter = 0;
        let skippedCount = 0;
        for (const h of hits) {
          const docId = String(h.payload?.documentId || '');
          const shouldSkip = !docId || (validIds.size > 0 && !validIds.has(docId));

          if (shouldSkip) {
            skippedCount++;
            console.debug('[Qdrant Retrieve] Skipping chunk', {
              documentId: docId,
              score: h.score
            });
            continue; // Skip soft-deleted or unknown documents
          }

          rankCounter += 1;
          aggregated.push({
            packageId: c.packageId,
            packageName: c.packageName,
            documentId: docId,
            filename: String(h.payload?.filename || ''),
            text: String(h.payload?.text || ''),
            score: Number(h.score || 0),
            rank: rankCounter,
          });
        }
        console.debug('[Qdrant Retrieve] Aggregated results', {
          collectionName: c.collectionName,
          aggregated: rankCounter,
          skipped: skippedCount
        });
      } catch (error) {
        console.error('[Qdrant Retrieve] Search failed for collection', {
          collectionName: c.collectionName,
          packageId: c.packageId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Si falla una colección, seguimos con las demás
      }
    }
    // Ordena por score desc
    aggregated.sort((a, b) => b.score - a.score);
    perQueryLists.push(aggregated.slice(0, 50));
  }

  // RRF fusion - keep original scores for display
  const rrfMap: Map<string, { item: RetrievedChunk; rrfScore: number; originalScore: number }> = new Map();
  const K = 60;
  for (const list of perQueryLists) {
    list.forEach((it, idx) => {
      const key = `${it.packageId}:${it.documentId}:${(it.text || '').slice(0, 50)}`;
      const prev = rrfMap.get(key);
      const rrf = 1 / (K + idx + 1);
      if (prev) {
        prev.rrfScore += rrf;
        // Keep the highest original score
        prev.originalScore = Math.max(prev.originalScore, it.score);
      } else {
        rrfMap.set(key, { item: it, rrfScore: rrf, originalScore: it.score });
      }
    });
  }

  // Sort by RRF score for ranking, but preserve original similarity score for display
  const fused = Array.from(rrfMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((x) => ({ ...x.item, score: x.originalScore })); // Use original Qdrant score

  // Agrupar resultados por documento para obtener contexto completo
  const byDocument = new Map<string, RetrievedChunk[]>();
  for (const r of fused) {
    const key = `${r.packageId}:${r.documentId}`;
    if (!byDocument.has(key)) {
      byDocument.set(key, []);
    }
    byDocument.get(key)!.push(r);
  }

  console.debug('[Qdrant Retrieve] Document grouping', {
    totalChunks: fused.length,
    uniqueDocs: byDocument.size,
    multiChunkDocs: Array.from(byDocument.values()).filter(chunks => chunks.length > 1).length
  });

  // Expandir cada resultado para incluir chunks vecinos del mismo documento
  const expanded: RetrievedChunk[] = [];
  const seenChunks = new Set<string>();

  // Tomar los top documentos basado en el mejor chunk de cada uno
  const topDocuments = Array.from(byDocument.entries())
    .sort((a, b) => {
      const bestScoreA = Math.max(...a[1].map(c => c.score));
      const bestScoreB = Math.max(...b[1].map(c => c.score));
      return bestScoreB - bestScoreA;
    })
    .slice(0, 8); // Top 8 documentos más relevantes

  console.debug('[Qdrant Retrieve] Top documents', {
    count: topDocuments.length,
    docs: topDocuments.map(([key, chunks]) => ({
      documentKey: key,
      chunksFound: chunks.length,
      bestScore: Math.max(...chunks.map(c => c.score))
    }))
  });

  for (const [docKey, chunks] of topDocuments) {
    // Ordenar chunks del mismo documento por score
    const sortedChunks = chunks.sort((a, b) => b.score - a.score);

    // Agregar todos los chunks del documento (ya están ordenados por relevancia)
    for (const chunk of sortedChunks) {
      const chunkKey = `${chunk.packageId}:${chunk.documentId}:${chunk.text?.substring(0, 50)}`;
      if (!seenChunks.has(chunkKey)) {
        expanded.push(chunk);
        seenChunks.add(chunkKey);
      }
    }
  }

  // Limitar el total de chunks finales
  const final = expanded.slice(0, 30);

  console.debug('[Qdrant Retrieve] Final results', {
    totalChunks: final.length,
    uniqueDocs: new Set(final.map(r => `${r.packageId}:${r.documentId}`)).size,
    results: final.slice(0, 5).map(r => ({
      packageId: r.packageId,
      packageName: r.packageName,
      filename: r.filename,
      score: r.score,
      textPreview: r.text?.substring(0, 80)
    }))
  });

  return final;
}

/**
 * Hybrid Search Configuration
 */
export interface HybridSearchParams {
  /** Weight for vector search (0-1, default: 0.7) */
  vectorWeight: number;
  /** Weight for BM25 keyword search (0-1, default: 0.3) */
  keywordWeight: number;
  /** Number of results to fetch from each method before fusion */
  fetchPerMethod: number;
  /** Final number of results to return */
  limit: number;
}

const DEFAULT_HYBRID_PARAMS: HybridSearchParams = {
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  fetchPerMethod: 50,
  limit: 30,
};

/**
 * Normalizes scores to 0-1 range for fair comparison
 */
function normalizeScores<T extends { score: number }>(results: T[]): T[] {
  if (results.length === 0) return results;

  const maxScore = Math.max(...results.map(r => r.score));
  const minScore = Math.min(...results.map(r => r.score));

  if (maxScore === minScore) {
    // All scores are the same, assign 1 to all
    return results.map(r => ({ ...r, score: 1 }));
  }

  return results.map(r => ({
    ...r,
    score: (r.score - minScore) / (maxScore - minScore),
  }));
}

/**
 * Fuse vector and BM25 results using weighted scoring
 */
function fuseResults(
  vectorResults: RetrievedChunk[],
  bm25Results: RetrievedChunk[],
  params: HybridSearchParams,
): RetrievedChunk[] {
  // Normalize both result sets to 0-1
  const normalizedVector = normalizeScores(vectorResults);
  const normalizedBM25 = normalizeScores(bm25Results);

  // Create map for all unique chunks
  const resultMap = new Map<string, RetrievedChunk & {
    vectorScore: number;
    bm25Score: number;
    fusedScore: number;
  }>();

  // Add vector results
  for (const r of normalizedVector) {
    const key = `${r.packageId}:${r.documentId}:${(r.text || '').slice(0, 50)}`;
    resultMap.set(key, {
      ...r,
      vectorScore: r.score,
      bm25Score: 0,
      fusedScore: r.score * params.vectorWeight,
    });
  }

  // Add/update with BM25 results
  for (const r of normalizedBM25) {
    const key = `${r.packageId}:${r.documentId}:${(r.text || '').slice(0, 50)}`;
    const existing = resultMap.get(key);

    if (existing) {
      // Merge scores
      existing.bm25Score = r.score;
      existing.fusedScore =
        existing.vectorScore * params.vectorWeight +
        r.score * params.keywordWeight;
    } else {
      // New result from BM25 only
      resultMap.set(key, {
        ...r,
        vectorScore: 0,
        bm25Score: r.score,
        fusedScore: r.score * params.keywordWeight,
      });
    }
  }

  // Convert back to array and sort by fused score
  const fused = Array.from(resultMap.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, params.limit)
    .map(r => ({
      ...r,
      score: r.fusedScore, // Replace score with fused score
    }));

  console.debug('[Hybrid Search] Fusion results', {
    total: fused.length,
    avgScore: fused.reduce((sum, r) => sum + r.fusedScore, 0) / fused.length,
    scores: fused.map(r => Math.round(r.fusedScore * 100) / 100),
    scoreDistribution: {
      bothMethods: fused.filter(r => r.vectorScore > 0 && r.bm25Score > 0).length,
      vectorOnly: fused.filter(r => r.vectorScore > 0 && r.bm25Score === 0).length,
      bm25Only: fused.filter(r => r.vectorScore === 0 && r.bm25Score > 0).length,
    },
  });

  return fused;
}

/**
 * Retrieve documents using hybrid search (vector + BM25)
 *
 * Combines semantic vector search with keyword-based BM25 search
 * for improved relevance across different query types.
 *
 * NOTE: This implementation re-ranks the vector search results using BM25,
 * which is more efficient than fetching all documents for BM25 indexing.
 *
 * @param params - Search parameters including teamSlug, packageIds, queries
 * @param hybridParams - Optional hybrid search configuration
 * @returns Array of retrieved chunks sorted by fused relevance score
 */
export async function retrieveHybrid(
  params: {
    teamSlug: string;
    packageIds: string[];
    queries: string[];
  },
  hybridParams?: Partial<HybridSearchParams>,
): Promise<RetrievedChunk[]> {
  const config = { ...DEFAULT_HYBRID_PARAMS, ...hybridParams };

  // 1. Get vector search results (fetch more than needed for BM25 re-ranking)
  const vectorResults = await retrieveFromQdrant({
    ...params,
  });
  if (vectorResults.length === 0) {
    return [];
  }

  // 2. Build BM25 index from the vector search results (re-ranking approach)
  // This is more efficient than building an index from all documents
  const bm25Docs = vectorResults.map(r => ({
    id: `${r.packageId}:${r.documentId}:${(r.text || '').slice(0, 50)}`,
    documentId: r.documentId || '',
    packageId: r.packageId,
    filename: r.filename,
    text: r.text || '',
    metadata: { packageName: r.packageName },
  }));

  const bm25Index = buildBM25Index(bm25Docs);

  // 3. Get BM25 search results (re-rank the same chunks)
  const combinedQuery = params.queries.join(' ');
  const bm25Results = searchBM25(bm25Index, combinedQuery, config.fetchPerMethod)
    .map(bm25ResultToRetrievedChunk);

  // 4. Fuse vector and BM25 results
  const fused = fuseResults(vectorResults, bm25Results, config);

  // 5. Group by document and expand (similar to vector search)
  const byDocument = new Map<string, RetrievedChunk[]>();
  for (const r of fused) {
    const key = `${r.packageId}:${r.documentId}`;
    if (!byDocument.has(key)) {
      byDocument.set(key, []);
    }
    byDocument.get(key)!.push(r);
  }

  // Take top documents and include all their chunks
  const topDocuments = Array.from(byDocument.entries())
    .sort((a, b) => {
      const bestScoreA = Math.max(...a[1].map(c => c.score));
      const bestScoreB = Math.max(...b[1].map(c => c.score));
      return bestScoreB - bestScoreA;
    })
    .slice(0, 8);

  const expanded: RetrievedChunk[] = [];
  const seenChunks = new Set<string>();

  for (const [, chunks] of topDocuments) {
    const sortedChunks = chunks.sort((a, b) => b.score - a.score);
    for (const chunk of sortedChunks) {
      const chunkKey = `${chunk.packageId}:${chunk.documentId}:${chunk.text?.substring(0, 50)}`;
      if (!seenChunks.has(chunkKey)) {
        expanded.push(chunk);
        seenChunks.add(chunkKey);
      }
    }
  }

  const final = expanded.slice(0, config.limit);

  console.debug('[Hybrid Search] Final results', {
    totalChunks: final.length,
    uniqueDocs: new Set(final.map(r => `${r.packageId}:${r.documentId}`)).size,
  });

  return final;
}

export function summarizeSnippet(text: string, maxLen = 300): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}…`;
}

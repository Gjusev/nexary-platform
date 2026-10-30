import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { allowedRagIds } from '@/lib/authz';
import { checkAndIncrementUsage, recordUsageEvent } from '@/lib/billing/limits';
import { normalizeQuery, rewriteQuery, retrieveFromQdrant, summarizeSnippet } from '@/lib/rag/query-pipeline';
import { evaluateRagGate } from '@/lib/rag/abstention';
import { query as dbQuery } from '@/lib/db';
import { ensureTeamExists } from '@/lib/ensure-team-sync';
import { checkRagRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * True when this request serves chat-context enrichment from one of the chat
 * routes (loopback/internal fetch flagged with `x-internal-chat-enrichment`).
 * Those routes evaluate the gate themselves against the exact context slice
 * they prompt with; also running the annotate evaluation here would log a
 * second, conflicting RAG_ABSTENTION_GATE entry per chat turn and double-count
 * calibration data. The flag is only honored for internal hosts so external
 * clients cannot silence the audit annotation.
 */
function servesInternalChatEnrichment(request: NextRequest): boolean {
  if (request.headers.get('x-internal-chat-enrichment') !== '1') {
    return false;
  }
  try {
    const host = new URL(request.url).hostname;
    const internalHost = process.env.INTERNAL_URL
      ? new URL(process.env.INTERNAL_URL).hostname
      : null;
    return (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === '::1' ||
      host === '[::1]' ||
      (internalHost !== null && host === internalHost)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();

  if (!user) {
    console.warn('[RAG Query] Unauthorized access attempt');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { query, packageIds, limit = 5 } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Query is required' 
      }, { status: 400 });
    }

    if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'At least one package ID is required' 
      }, { status: 400 });
    }

    // Obtener el equipo del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      console.error('[RAG Query] No team found for user');
      return NextResponse.json({ success: false, error: 'No team found' }, { status: 400 });
    }

    // Obtener el slug del team desde la base de datos (auto-sync si es necesario)
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug } = await ensureTeamExists(teamId, teamName, 'RAG Query');
    const userId = (user as any).id || '';

    // Enforce usage limits and filter allowed RAGs for this user/team
    try {
      await checkAndIncrementUsage(teamSlug, 'queries', 1);
    } catch {
      return NextResponse.json({ success: false, error: 'QUERY_LIMIT_REACHED' }, { status: 403 });
    }

    let effectivePackageIds: string[] = packageIds;
    try {
      const allowed = new Set(await allowedRagIds(teamSlug, userId));

      if (allowed.size > 0) {
        effectivePackageIds = packageIds.filter((id: string) => allowed.has(id));
      }
    } catch (e) {
      console.warn('[RAG Query] Access check failed, using original package list', e);
      // If access check fails, default to original list
    }

    // Rewrite the query (spell‑check/normalize) and retrieve from Qdrant
    const normalized = normalizeQuery(query);
    const { best } = await rewriteQuery(normalized);
    const queries = [best]; // Solo usar la consulta optimizada
    
    const retrieved = await retrieveFromQdrant({ teamSlug, packageIds: effectivePackageIds, queries });

    // Conformal abstention gate: score the evidence and log the decision.
    // This endpoint is search-only, so the gate annotates instead of
    // enforcing; chat routes enforce against generation. Skip the annotate
    // evaluation for internal chat enrichment (see servesInternalChatEnrichment).
    let abstention: Record<string, unknown> | undefined;
    if (!servesInternalChatEnrichment(request)) {
      try {
        const gate = await evaluateRagGate({
          query,
          results: retrieved,
          teamSlug,
          userId,
          packageIds: effectivePackageIds,
        });
        abstention = {
          enabled: gate.gateEnabled,
          decision: gate.decision,
          enforced: false,
          support: {
            score: gate.support.score,
            top: gate.support.top,
            lexical: gate.support.lexical,
            candidates: gate.support.candidates,
          },
          threshold: gate.outcome.threshold,
          thresholdSource: gate.outcome.thresholdSource,
        };
      } catch (gateError) {
        console.warn('[RAG Query] Abstention gate failed, continuing without annotation:', gateError);
      }
    }

    const results: any[] = retrieved.map((r) => ({
      content: r.text || '', // Enviar el contenido completo, sin truncar
      score: r.score,
      metadata: {
        packageId: r.packageId,
        packageName: r.packageName,
        documentId: r.documentId,
        filename: r.filename,
      },
    }));

    // Record usage event per package (for breakdown)
    try {
      for (const pid of effectivePackageIds) {
        await recordUsageEvent(teamSlug, userId, 'rag.query', pid, { queried: true });
      }
    } catch {}

    // Limit results
    const limitedResults = results.slice(0, limit);
    
    return NextResponse.json({
      success: true,
      results: limitedResults,
      query,
      optimizedQuery: best,
      packageIds: effectivePackageIds,
      totalResults: limitedResults.length,
      ...(abstention ? { abstention } : {}),
    });
  } catch (error) {
    console.error('Error in RAG query:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to query RAG packages' },
      { status: 500 }
    );
  }
}

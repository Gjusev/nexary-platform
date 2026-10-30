/**
 * Regression tests for the authorization filtering in POST /api/rag/query.
 *
 * Covers MOK-77: the endpoint must fail closed. An empty grant set must
 * never fall through to the raw client-supplied package ids, a failing
 * access check must never fall back to the unfiltered list, and
 * authorization must precede metering (a refused request never spends
 * quota or LLM budget).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@stackframe/stack', () => ({
  StackServerApp: class {
    getUser() {
      return Promise.resolve({
        id: 'user-1',
        listTeams: vi.fn().mockResolvedValue([]),
        selectedTeam: { id: 'team-1', displayName: 'Acme' },
      });
    }
  },
}));

vi.mock('@/lib/authz', () => ({
  allowedRagIds: vi.fn(),
}));

vi.mock('@/lib/middleware/api-rate-limit', () => ({
  checkRagRateLimit: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/billing/limits', () => ({
  checkAndIncrementUsage: vi.fn().mockResolvedValue(undefined),
  recordUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ensure-team-sync', () => ({
  ensureTeamExists: vi.fn().mockResolvedValue({ teamSlug: 'acme' }),
}));

vi.mock('@/lib/rag/query-pipeline', () => ({
  normalizeQuery: vi.fn((q: string) => q),
  rewriteQuery: vi.fn().mockResolvedValue({ best: 'optimized query' }),
  retrieveFromQdrant: vi.fn().mockResolvedValue([]),
  summarizeSnippet: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

import { allowedRagIds } from '@/lib/authz';
import { checkAndIncrementUsage } from '@/lib/billing/limits';
import { rewriteQuery, retrieveFromQdrant } from '@/lib/rag/query-pipeline';
import { POST } from './route';

const mockAllowedRagIds = allowedRagIds as unknown as ReturnType<typeof vi.fn>;
const mockCheckAndIncrementUsage = checkAndIncrementUsage as unknown as ReturnType<typeof vi.fn>;
const mockRewriteQuery = rewriteQuery as unknown as ReturnType<typeof vi.fn>;
const mockRetrieveFromQdrant = retrieveFromQdrant as unknown as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/rag/query', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/rag/query authorization filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRetrieveFromQdrant.mockResolvedValue([]);
  });

  it('fail closed on an empty grant set: 403 NO_RAG_GRANTS, nothing queried or metered', async () => {
    // Zero grants used to skip filtering entirely, exposing every
    // client-supplied id. It must refuse with a distinct signal instead of
    // a benign empty answer that masks the misconfiguration.
    mockAllowedRagIds.mockResolvedValue([]);

    const response = await POST(makeRequest({ query: 'hello', packageIds: ['pkg-a', 'pkg-b'] }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('NO_RAG_GRANTS');
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
    expect(mockRewriteQuery).not.toHaveBeenCalled();
    // Authz precedes metering: a refused request never spends quota.
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it('fail closed when the grant list is null/undefined: treated as zero grants', async () => {
    // `new Set(null)` is an empty Set; pin that a nullish grant list can
    // never behave like an unrestricted one.
    mockAllowedRagIds.mockResolvedValue(null as unknown as string[]);

    const response = await POST(makeRequest({ query: 'hello', packageIds: ['pkg-a'] }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe('NO_RAG_GRANTS');
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it('keeps only granted ids when the grant set is non-empty, retrieving exactly once', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);

    const response = await POST(
      makeRequest({ query: 'hello', packageIds: ['pkg-allowed', 'pkg-secret'] })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    // toHaveBeenCalledTimes guards against a duplicate unfiltered call
    // slipping past toHaveBeenCalledWith.
    expect(mockRetrieveFromQdrant).toHaveBeenCalledTimes(1);
    expect(mockRetrieveFromQdrant).toHaveBeenCalledWith(
      expect.objectContaining({ packageIds: ['pkg-allowed'] })
    );
    expect(json.packageIds).toEqual(['pkg-allowed']);
    // Authz before metering: the grant check runs before usage increment.
    expect(mockCheckAndIncrementUsage).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrementUsage.mock.invocationCallOrder[0]).toBeLessThan(
      mockRetrieveFromQdrant.mock.invocationCallOrder[0]
    );
  });

  it('returns empty results without spending quota or LLM budget on no overlap', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);

    const response = await POST(makeRequest({ query: 'hello', packageIds: ['pkg-secret'] }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.results).toEqual([]);
    expect(json.packageIds).toEqual([]);
    expect(json.totalResults).toBe(0);
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
    expect(mockRewriteQuery).not.toHaveBeenCalled();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it('returns 403 and queries nothing when the access check throws', async () => {
    // A failing access check used to fall back to the unfiltered list.
    mockAllowedRagIds.mockRejectedValue(new Error('authz store unavailable'));

    const response = await POST(makeRequest({ query: 'hello', packageIds: ['pkg-a'] }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('ACCESS_CHECK_FAILED');
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
    expect(mockRewriteQuery).not.toHaveBeenCalled();
    // Authz precedes metering: a refused request never spends quota.
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });
});

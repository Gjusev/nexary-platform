/**
 * Regression tests for the authorization filtering in POST /api/rag/query.
 *
 * Covers MOK-77: the endpoint must fail closed. An empty grant set must
 * never fall through to the raw client-supplied package ids, and a failing
 * access check must never fall back to the unfiltered list.
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
import { retrieveFromQdrant } from '@/lib/rag/query-pipeline';
import { POST } from './route';

const mockAllowedRagIds = allowedRagIds as unknown as ReturnType<typeof vi.fn>;
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

  it('fail closed on an empty grant set: no package ids are queried', async () => {
    // Zero grants used to skip filtering entirely, exposing every
    // client-supplied id. It must yield an empty effective list instead.
    mockAllowedRagIds.mockResolvedValue([]);

    const response = await POST(makeRequest({ query: 'hello', packageIds: ['pkg-a', 'pkg-b'] }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(mockRetrieveFromQdrant).toHaveBeenCalledWith(
      expect.objectContaining({ packageIds: [] })
    );
    expect(json.success).toBe(true);
    expect(json.packageIds).toEqual([]);
    expect(json.results).toEqual([]);
    expect(json.totalResults).toBe(0);
  });

  it('keeps only granted ids when the grant set is non-empty', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);

    const response = await POST(
      makeRequest({ query: 'hello', packageIds: ['pkg-allowed', 'pkg-secret'] })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(mockRetrieveFromQdrant).toHaveBeenCalledWith(
      expect.objectContaining({ packageIds: ['pkg-allowed'] })
    );
    expect(json.packageIds).toEqual(['pkg-allowed']);
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
  });
});

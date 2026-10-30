/**
 * Regression tests for the authorization filtering in GET /api/debug/rag-flow.
 *
 * Covers MOK-85: step 6 used to search every team package
 * (`packages.map(p => p.id)` from `listPackages(teamSlug, false)`) and step 4
 * listed every package, so any authenticated team member could read team-wide
 * chunk text regardless of their per-user grants. The endpoint must fail
 * closed like POST /api/rag/query: an empty grant set or a failing grant
 * check refuses the request, and listing/search only ever touch granted ids.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

let mockUser: Record<string, unknown> | null = {
  id: 'user-1',
  listTeams: () => Promise.resolve([]),
  selectedTeam: { id: 'team-1', displayName: 'Acme' },
};

vi.mock('@stackframe/stack', () => ({
  StackServerApp: class {
    getUser() {
      return Promise.resolve(mockUser);
    }
  },
}));

vi.mock('@/lib/authz', () => ({
  allowedRagIds: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ slug: 'acme', name: 'Acme' }] }),
}));

vi.mock('@/lib/rag/store', () => ({
  listPackages: vi.fn(),
}));

vi.mock('@/lib/rag/query-pipeline', () => ({
  normalizeQuery: vi.fn((q: string) => q),
  rewriteQuery: vi.fn().mockResolvedValue({ best: 'optimized query' }),
  retrieveFromQdrant: vi.fn().mockResolvedValue([]),
}));

import { allowedRagIds } from '@/lib/authz';
import { listPackages } from '@/lib/rag/store';
import { retrieveFromQdrant } from '@/lib/rag/query-pipeline';
import { GET } from './route';

const mockAllowedRagIds = allowedRagIds as unknown as ReturnType<typeof vi.fn>;
const mockListPackages = listPackages as unknown as ReturnType<typeof vi.fn>;
const mockRetrieveFromQdrant = retrieveFromQdrant as unknown as ReturnType<typeof vi.fn>;

const SECRET_CHUNK = 'CONFIDENTIAL_CHUNK_TEXT';

// The secret package simulates team content the caller was never granted.
const TEAM_PACKAGES = [
  {
    id: 'pkg-allowed',
    name: 'Allowed Package',
    teamSlug: 'acme',
    collectionName: 'acme_allowed',
    documents: [{ id: 'doc-1', filename: 'public.pdf', chunkCount: 3 }],
  },
  {
    id: 'pkg-secret',
    name: 'Secret Package',
    teamSlug: 'acme',
    collectionName: 'acme_secret',
    documents: [{ id: 'doc-2', filename: 'secret.pdf', chunkCount: 42 }],
  },
];

// Honors the packageIds it receives, so a filtered call can never surface
// the secret chunk while an unfiltered call (the old behavior) always would.
function wireRetrieval(): void {
  mockRetrieveFromQdrant.mockImplementation(async ({ packageIds }: { packageIds: string[] }) =>
    packageIds.includes('pkg-secret')
      ? [
          {
            packageId: 'pkg-secret',
            text: SECRET_CHUNK,
            score: 0.9,
            documentId: 'doc-2',
            filename: 'secret.pdf',
            packageName: 'Secret Package',
          },
        ]
      : [
          {
            packageId: 'pkg-allowed',
            text: 'public chunk text',
            score: 0.8,
            documentId: 'doc-1',
            filename: 'public.pdf',
            packageName: 'Allowed Package',
          },
        ]
  );
}

function makeRequest(queryParam?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/debug/rag-flow');
  if (queryParam) url.searchParams.set('query', queryParam);
  return new NextRequest(url.toString());
}

describe('GET /api/debug/rag-flow authorization filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-1',
      listTeams: () => Promise.resolve([]),
      selectedTeam: { id: 'team-1', displayName: 'Acme' },
    };
    mockListPackages.mockResolvedValue(TEAM_PACKAGES);
    mockRetrieveFromQdrant.mockResolvedValue([]);
    // Step 7 pings Qdrant directly; stub it so tests stay offline.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ result: { collections: [] } }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 401 for an unauthenticated caller', async () => {
    mockUser = null;

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
  });

  it('fail closed on an empty grant set: 403 NO_RAG_GRANTS, nothing listed or searched', async () => {
    // Zero grants used to fall through to every team package and return
    // chunk text (MOK-85). It must refuse with a distinct signal instead.
    mockAllowedRagIds.mockResolvedValue([]);
    wireRetrieval();

    const response = await GET(makeRequest('hello'));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('NO_RAG_GRANTS');
    // The refusal precedes any package enumeration or retrieval.
    expect(mockListPackages).not.toHaveBeenCalled();
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
    const body = JSON.stringify(json);
    expect(body).not.toContain('pkg-secret');
    expect(body).not.toContain('secret.pdf');
    expect(body).not.toContain(SECRET_CHUNK);
  });

  it('fail closed when the grant list is null/undefined: treated as zero grants', async () => {
    mockAllowedRagIds.mockResolvedValue(null as unknown as string[]);

    const response = await GET(makeRequest('hello'));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('NO_RAG_GRANTS');
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
  });

  it('returns 403 and queries nothing when the grant check throws', async () => {
    // A failing grant check must never fall back to the team-wide list.
    mockAllowedRagIds.mockRejectedValue(new Error('authz store unavailable'));
    wireRetrieval();

    const response = await GET(makeRequest('hello'));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('ACCESS_CHECK_FAILED');
    expect(mockListPackages).not.toHaveBeenCalled();
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
    const body = JSON.stringify(json);
    expect(body).not.toContain('pkg-secret');
    expect(body).not.toContain(SECRET_CHUNK);
  });

  it('restricts the search to granted package ids only', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);
    wireRetrieval();

    const response = await GET(makeRequest('hello'));

    expect(response.status).toBe(200);
    const json = await response.json();
    // toHaveBeenCalledTimes guards against a duplicate unfiltered call
    // slipping past toHaveBeenCalledWith.
    expect(mockRetrieveFromQdrant).toHaveBeenCalledTimes(1);
    expect(mockRetrieveFromQdrant).toHaveBeenCalledWith(
      expect.objectContaining({ packageIds: ['pkg-allowed'] })
    );
    expect(json.steps.step6_search.data.packagesSearched).toEqual(['pkg-allowed']);
    const body = JSON.stringify(json);
    // The retrieval mock would have surfaced the secret chunk if the route
    // had passed the unfiltered team-wide id list.
    expect(body).not.toContain('pkg-secret');
    expect(body).not.toContain(SECRET_CHUNK);
  });

  it('lists only granted packages, exposing ungranted ones as a count', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.steps.step4_packages.data.count).toBe(1);
    expect(json.steps.step4_packages.data.totalTeamPackages).toBe(2);
    expect(json.steps.step4_packages.data.filteredByUserGrants).toBe(true);
    expect(json.steps.step4_packages.data.packages).toHaveLength(1);
    expect(json.steps.step4_packages.data.packages[0].id).toBe('pkg-allowed');
    const body = JSON.stringify(json);
    expect(body).not.toContain('pkg-secret');
    expect(body).not.toContain('secret.pdf');
  });

  it('skips the search without retrieving when no grant overlaps a listed package', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-gone']);

    const response = await GET(makeRequest('hello'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.steps.step6_search.status).toBe('SKIPPED');
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
  });

  it('skips the search when no query param is provided, without retrieving', async () => {
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.steps.step6_search.status).toBe('SKIPPED');
    expect(mockRetrieveFromQdrant).not.toHaveBeenCalled();
  });
});

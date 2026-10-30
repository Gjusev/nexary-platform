/**
 * Regression tests for the metadata disclosure in GET /api/debug/rag-flow.
 *
 * Covers MOK-94: step 7 used to call the instance-wide `GET /collections`
 * endpoint on Qdrant and echo the raw `QDRANT_URL`. Collection names embed
 * other teams' slugs and package names, so any authenticated team member
 * could enumerate the whole Qdrant instance (cross-team metadata), and a
 * QDRANT_URL with embedded credentials was returned verbatim. Step 6's catch
 * and the top-level 500 handler also echoed raw error stacks to the client.
 * Step 7 must now check only the caller team's own collections (derived
 * server-side from the DB), never list the instance, never return the URL or
 * API key, and no handler may echo error stacks or infrastructure details.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET_QDRANT_URL = 'http://debug-user:debug-pass@qdrant.internal:6333';
const SECRET_API_KEY = 'sk-debug-api-key';
const OWN_COLLECTION = 'acme_docs_abc12345';
const OTHER_TEAM_COLLECTION = 'otros-team_secreto_xyz9999';

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

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ slug: 'acme', name: 'Acme' }] }),
}));

vi.mock('@/lib/authz', () => ({
  allowedRagIds: vi.fn().mockResolvedValue(['pkg-1']),
}));

vi.mock('@/lib/rag/store', () => ({
  listPackages: vi.fn(),
}));

vi.mock('@/lib/rag/query-pipeline', () => ({
  normalizeQuery: (q: string) => q,
  rewriteQuery: vi.fn().mockResolvedValue({ best: 'rewritten query' }),
  retrieveFromQdrant: vi.fn().mockResolvedValue([]),
}));

import { listPackages } from '@/lib/rag/store';
import { retrieveFromQdrant } from '@/lib/rag/query-pipeline';
import { query } from '@/lib/db';
import { GET } from './route';

const mockListPackages = listPackages as unknown as ReturnType<typeof vi.fn>;
const mockRetrieveFromQdrant = retrieveFromQdrant as unknown as ReturnType<typeof vi.fn>;
const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

const TEAM_PACKAGES = [
  {
    id: 'pkg-1',
    name: 'Docs',
    teamSlug: 'acme',
    collectionName: OWN_COLLECTION,
    documents: [],
  },
];

const fetchMock = vi.fn();

function wireQdrant(): void {
  fetchMock.mockImplementation(async (url: string | URL) => {
    const target = String(url);
    // Any collection the route asks about that is NOT one of the caller's own
    // collections must never be contacted — surface it loudly.
    if (target.includes(OTHER_TEAM_COLLECTION)) {
      throw new Error(`route contacted foreign collection: ${target}`);
    }
    return {
      ok: true,
      json: async () => ({ result: { status: 'green', points_count: 42 } }),
    };
  });
}

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/debug/rag-flow');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return new NextRequest(url.toString());
}

function expectNoSecrets(json: unknown): void {
  const body = JSON.stringify(json);
  expect(body).not.toContain('qdrant.internal');
  expect(body).not.toContain('debug-user');
  expect(body).not.toContain('debug-pass');
  expect(body).not.toContain(SECRET_API_KEY);
  expect(body).not.toContain('QDRANT_URL');
  expect(body).not.toContain(OTHER_TEAM_COLLECTION);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = {
    id: 'user-1',
    listTeams: () => Promise.resolve([]),
    selectedTeam: { id: 'team-1', displayName: 'Acme' },
  };
  mockListPackages.mockResolvedValue(TEAM_PACKAGES);
  wireQdrant();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('QDRANT_URL', SECRET_QDRANT_URL);
  vi.stubEnv('QDRANT_API_KEY', SECRET_API_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/debug/rag-flow step 7 scoping and hygiene', () => {
  it('checks only the caller team collections and never lists the instance-wide endpoint', async () => {
    const response = await GET(makeRequest());
    const json = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(TEAM_PACKAGES.length);
    for (const call of fetchMock.mock.calls) {
      const target = String(call[0]);
      expect(target).toContain(`/collections/${OWN_COLLECTION}`);
      // The instance-wide listing must not be called at all.
      expect(target.endsWith('/collections')).toBe(false);
    }

    expect(json.steps.step7_qdrant.status).toBe('SUCCESS');
    expect(json.steps.step7_qdrant.data.connected).toBe(true);
    expect(json.steps.step7_qdrant.data.collections[0].collection).toBe(OWN_COLLECTION);
    expect(json.steps.step7_qdrant.data.collections[0].pointsCount).toBe(42);
    expectNoSecrets(json);
  });

  it('never returns QDRANT_URL or the Qdrant API key, even with credentials embedded in the URL', async () => {
    const response = await GET(makeRequest());
    const json = await response.json();

    expect(json.steps.step7_qdrant.data.qdrantUrl).toBeUndefined();
    expectNoSecrets(json);
  });

  it('skips the Qdrant check when the team has no packages', async () => {
    mockListPackages.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.steps.step7_qdrant.status).toBe('SKIPPED');
    expectNoSecrets(json);
  });

  it('reports Qdrant per-collection failures generically without leaking the URL', async () => {
    // The rejected fetch error message embeds the secret URL on purpose: the
    // old route echoed error.message verbatim, which would leak it.
    fetchMock.mockRejectedValue(
      new TypeError(`fetch failed via ${SECRET_QDRANT_URL}`)
    );

    const response = await GET(makeRequest({ query: 'hola' }));
    const json = await response.json();

    expect(json.steps.step7_qdrant.status).toBe('SUCCESS');
    expect(json.steps.step7_qdrant.data.connected).toBe(false);
    expect(json.steps.step7_qdrant.data.collections[0].reachable).toBe(false);
    expectNoSecrets(json);
  });

  it('refuses the whole step with a generic error when listing own packages fails', async () => {
    mockListPackages.mockRejectedValue(new Error('getaddrinfo ENOTFOUND db.internal'));

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.steps.step7_qdrant.status).toBe('ERROR');
    expect(json.steps.step7_qdrant.error).toBe('Qdrant request failed');
    expectNoSecrets(json);
  });

  it('does not echo the step 6 error stack', async () => {
    const err = new Error('search failed');
    err.stack = 'Error: search failed\n    at SECRET_STACK_FRAME (internal://qdrant)';
    mockRetrieveFromQdrant.mockRejectedValue(err);

    const response = await GET(makeRequest({ query: 'hola' }));
    const json = await response.json();

    expect(json.steps.step6_search.status).toBe('ERROR');
    expect(json.steps.step6_search.stack).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain('SECRET_STACK_FRAME');
  });

  it('returns a generic 500 without message or stack when an unexpected error escapes', async () => {
    const dbError = new Error('pg: connection refused by db-internal-host.internal');
    dbError.stack = 'Error: pg: connection refused\n    at SECRET_STACK_FRAME (internal://db)';
    mockQuery.mockRejectedValue(dbError);

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.stack).toBeUndefined();
    expect(json.error.message).toBe('Internal error');
    const body = JSON.stringify(json);
    expect(body).not.toContain('db-internal-host');
    expect(body).not.toContain('SECRET_STACK_FRAME');
  });

  it('still returns 401 before touching Qdrant when unauthenticated', async () => {
    mockUser = null;

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mockListPackages).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

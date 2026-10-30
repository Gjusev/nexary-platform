/**
 * Regression tests for the authentication and authorization of
 * GET /api/debug/test-rag-search.
 *
 * Covers MOK-93: the endpoint used to accept arbitrary client-supplied
 * `collection`, `teamSlug` and `packageId` params with no authentication at
 * all (middleware excludes /api from its matcher), searched the requested
 * collection both with and without filters against any collection in the
 * Qdrant instance, and echoed raw chunk-text previews plus error stack
 * traces. It must now require a session, derive team and collection
 * server-side, fail closed on the grant check like POST /api/rag/query
 * (MOK-77 contract), and never search unfiltered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  embedTexts: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3, 0.4]]),
}));

vi.mock('@/lib/rag/qdrant', () => ({
  searchQdrant: vi.fn(),
}));

import { allowedRagIds } from '@/lib/authz';
import { listPackages } from '@/lib/rag/store';
import { searchQdrant } from '@/lib/rag/qdrant';
import { GET } from './route';

const mockAllowedRagIds = allowedRagIds as unknown as ReturnType<typeof vi.fn>;
const mockListPackages = listPackages as unknown as ReturnType<typeof vi.fn>;
const mockSearchQdrant = searchQdrant as unknown as ReturnType<typeof vi.fn>;

const SECRET_CHUNK = 'CONFIDENTIAL_CHUNK_TEXT';
const SECRET_COLLECTION = 'acme_secret';

// The secret package simulates team content the caller was never granted.
const TEAM_PACKAGES = [
  {
    id: 'pkg-allowed',
    name: 'Allowed Package',
    teamSlug: 'acme',
    collectionName: 'acme_allowed',
    documents: [],
  },
  {
    id: 'pkg-secret',
    name: 'Secret Package',
    teamSlug: 'acme',
    collectionName: SECRET_COLLECTION,
    documents: [],
  },
];

function makePoint(packageId: string, teamSlug: string, text: string) {
  return {
    id: `point-${packageId}`,
    score: 0.9,
    payload: {
      packageId,
      team_slug: teamSlug,
      documentId: `doc-${packageId}`,
      filename: `${packageId}.pdf`,
      text,
    },
  };
}

// Honors the arguments it receives, so a call that bypasses the filters or
// points at the secret collection (the old behavior) always surfaces the
// secret chunk and fails these tests, while a correctly filtered call
// against the granted package never does.
function wireSearch(): void {
  mockSearchQdrant.mockImplementation(
    async (
      collectionName: string,
      _vector: number[],
      _limit?: number,
      filter?: { must?: Array<{ key: string; match: { value: string } }> }
    ) => {
      const must = filter?.must ?? [];
      const teamSlug = must.find(f => f.key === 'team_slug')?.match?.value;
      const packageId = must.find(f => f.key === 'packageId')?.match?.value;

      if (collectionName === SECRET_COLLECTION) {
        return [makePoint('pkg-secret', 'other-team', SECRET_CHUNK)];
      }
      if (collectionName === 'acme_allowed' && teamSlug === 'acme' && packageId === 'pkg-allowed') {
        return [makePoint('pkg-allowed', 'acme', 'public chunk text')];
      }
      return [];
    }
  );
}

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/debug/test-rag-search');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return new NextRequest(url.toString());
}

function expectNoSecret(json: unknown): void {
  const body = JSON.stringify(json);
  expect(body).not.toContain('pkg-secret');
  expect(body).not.toContain(SECRET_COLLECTION);
  expect(body).not.toContain(SECRET_CHUNK);
  expect(body).not.toContain('Secret Package');
}

describe('GET /api/debug/test-rag-search authentication and grants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-1',
      listTeams: () => Promise.resolve([]),
      selectedTeam: { id: 'team-1', displayName: 'Acme' },
    };
    mockAllowedRagIds.mockResolvedValue(['pkg-allowed']);
    mockListPackages.mockResolvedValue(TEAM_PACKAGES);
    wireSearch();
  });

  it('returns 401 for an unauthenticated caller and never touches Qdrant', async () => {
    mockUser = null;

    const response = await GET(makeRequest({ query: 'hello', packageId: 'pkg-allowed' }));

    expect(response.status).toBe(401);
    expect(mockListPackages).not.toHaveBeenCalled();
    expect(mockSearchQdrant).not.toHaveBeenCalled();
    expectNoSecret(await response.json());
  });

  it('returns 400 when query or packageId is missing', async () => {
    const response = await GET(makeRequest({ query: 'hello' }));

    expect(response.status).toBe(400);
    expect(mockAllowedRagIds).not.toHaveBeenCalled();
    expect(mockSearchQdrant).not.toHaveBeenCalled();
  });

  it('fail closed on an empty grant set: 403 NO_RAG_GRANTS, nothing listed or searched', async () => {
    // Zero grants used to be irrelevant (no auth at all); they must now
    // refuse with a distinct signal before any package enumeration.
    mockAllowedRagIds.mockResolvedValue([]);
    wireSearch();

    const response = await GET(makeRequest({ query: 'hello', packageId: 'pkg-allowed' }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('NO_RAG_GRANTS');
    expect(mockListPackages).not.toHaveBeenCalled();
    expect(mockSearchQdrant).not.toHaveBeenCalled();
    expectNoSecret(json);
  });

  it('treats nullish grants as zero grants', async () => {
    mockAllowedRagIds.mockResolvedValue(null as unknown as string[]);

    const response = await GET(makeRequest({ query: 'hello', packageId: 'pkg-allowed' }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('NO_RAG_GRANTS');
    expect(mockSearchQdrant).not.toHaveBeenCalled();
  });

  it('returns 403 ACCESS_CHECK_FAILED and queries nothing when the grant check throws', async () => {
    // A failing grant check must never fall through to a search.
    mockAllowedRagIds.mockRejectedValue(new Error('authz store unavailable'));
    wireSearch();

    const response = await GET(makeRequest({ query: 'hello', packageId: 'pkg-allowed' }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('ACCESS_CHECK_FAILED');
    expect(mockListPackages).not.toHaveBeenCalled();
    expect(mockSearchQdrant).not.toHaveBeenCalled();
    expectNoSecret(json);
  });

  it('searches only the server-derived collection of the granted package, with mandatory filters', async () => {
    wireSearch();

    // Hostile legacy params: collection/teamSlug of the secret package must
    // be ignored — the route derives everything from the session + packageId.
    const response = await GET(
      makeRequest({
        query: 'hello',
        packageId: 'pkg-allowed',
        collection: SECRET_COLLECTION,
        teamSlug: 'other-team',
      })
    );

    expect(response.status).toBe(200);
    expect(mockSearchQdrant).toHaveBeenCalledTimes(1);
    expect(mockSearchQdrant).toHaveBeenCalledWith(
      'acme_allowed',
      expect.any(Array),
      5,
      {
        must: [
          { key: 'team_slug', match: { value: 'acme' } },
          { key: 'packageId', match: { value: 'pkg-allowed' } },
        ],
      }
    );
    const json = await response.json();
    expect(json.package.collectionName).toBe('acme_allowed');
    expect(json.results.count).toBe(1);
    expect(JSON.stringify(json)).toContain('public chunk text');
    expectNoSecret(json);
  });

  it('refuses an ungranted package in the caller team with 403 PACKAGE_NOT_GRANTED', async () => {
    wireSearch();

    const response = await GET(
      makeRequest({
        query: 'hello',
        packageId: 'pkg-secret',
        collection: SECRET_COLLECTION,
      })
    );

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.refused).toBe('PACKAGE_NOT_GRANTED');
    expect(mockSearchQdrant).not.toHaveBeenCalled();
    // The caller-supplied packageId is echoed back, but nothing the caller
    // did not already send: no collection, no package name, no chunk text.
    const body = JSON.stringify(json);
    expect(body).not.toContain(SECRET_COLLECTION);
    expect(body).not.toContain('Secret Package');
    expect(body).not.toContain(SECRET_CHUNK);
    expect(json.package).toBeUndefined();
    expect(json.results).toBeUndefined();
  });

  it('refuses a cross-team or unknown packageId with 404, ignoring the collection param', async () => {
    wireSearch();

    const response = await GET(
      makeRequest({
        query: 'hello',
        packageId: 'pkg-from-other-team',
        collection: SECRET_COLLECTION,
        teamSlug: 'other-team',
      })
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(mockSearchQdrant).not.toHaveBeenCalled();
    expectNoSecret(json);
  });

  it('returns a generic 500 without stack trace or internal details', async () => {
    mockSearchQdrant.mockRejectedValue(new Error('qdrant exploded with secrets'));

    const response = await GET(makeRequest({ query: 'hello', packageId: 'pkg-allowed' }));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.stack).toBeUndefined();
    expect(json.details).toBeUndefined();
    const body = JSON.stringify(json);
    expect(body).not.toContain('qdrant exploded');
    expect(body).not.toContain('at ');
  });
});

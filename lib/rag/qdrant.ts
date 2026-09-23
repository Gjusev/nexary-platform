const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

export const EMBEDDING_VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE ?? 3072);
export const QDRANT_DISTANCE = process.env.QDRANT_DISTANCE ?? 'Cosine';

export class QdrantError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string) {
    super(`Qdrant request failed (${status}): ${responseBody}`);
    this.name = 'QdrantError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

type QdrantRequestInit = RequestInit & {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  allowStatuses?: number[];
  skipJson?: boolean;
};

type QdrantPoint = {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
};

type QdrantFilter = Record<string, unknown>;

function requireQdrantUrl(): string {
  if (!QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is not set.');
  }
  return QDRANT_URL;
}

function buildUrl(base: string, pathname: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(pathname, base);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function parseJsonSafe<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function qdrantFetch<T = unknown>({ path, query, allowStatuses = [], skipJson = false, ...init }: QdrantRequestInit): Promise<T> {
  const baseUrl = requireQdrantUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY;
  }

  const response = await fetch(buildUrl(baseUrl, path, query), {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (allowStatuses.includes(response.status)) {
      if (skipJson || response.status === 204) {
        return undefined as T;
      }
      const payload = await parseJsonSafe<T>(response);
      return (payload ?? (undefined as T));
    }

    const bodyText = await response.text();
    throw new QdrantError(response.status, bodyText);
  }

  if (skipJson || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function ensureCollection(collectionName: string): Promise<void> {
  try {
    // Check if collection exists (200 => exists; 404 => create)
    await qdrantFetch({
      path: `/collections/${collectionName}`,
      method: 'GET',
      skipJson: true,
    });
    return;
  } catch (error) {
    if (error instanceof QdrantError && error.status === 404) {
      // Create collection
      try {
        await qdrantFetch({
          path: `/collections/${collectionName}`,
          method: 'PUT',
          body: JSON.stringify({
            vectors: {
              size: EMBEDDING_VECTOR_SIZE,
              distance: QDRANT_DISTANCE,
            },
            on_disk_payload: true,
          }),
          skipJson: true,
        });
      } catch (createError) {
        if (createError instanceof QdrantError && createError.status === 409) {
          return;
        }
        throw createError;
      }
      return;
    }
    throw error;
  }
}

export async function upsertPoints(collectionName: string, points: QdrantPoint[]): Promise<void> {
  if (points.length === 0) return;
  await qdrantFetch({
    path: `/collections/${collectionName}/points`,
    method: 'PUT',
    query: { wait: true },
    body: JSON.stringify({ points }),
    skipJson: true,
  });
}

export async function deletePoints(collectionName: string, pointIds: string[]): Promise<void> {
  if (pointIds.length === 0) return;
  await qdrantFetch({
    path: `/collections/${collectionName}/points/delete`,
    method: 'POST',
    query: { wait: true },
    body: JSON.stringify({ points: pointIds }),
    skipJson: true,
  });
}

export async function deletePointsByFilter(collectionName: string, filter: QdrantFilter): Promise<void> {
  await qdrantFetch({
    path: `/collections/${collectionName}/points/delete`,
    method: 'POST',
    query: { wait: true },
    body: JSON.stringify({ filter }),
    skipJson: true,
  });
}

export type { QdrantPoint, QdrantFilter };

// Search in a collection with vector and optional payload filter
export async function searchQdrant(
  collectionName: string,
  vector: number[],
  limit = 10,
  filter?: { must?: Array<Record<string, any>> }
): Promise<Array<{ id: string | number; score: number; payload?: Record<string, any> }>> {
  const res = await qdrantFetch<{ result: Array<{ id: string | number; score: number; payload?: Record<string, any> }> }>({
    path: `/collections/${collectionName}/points/search`,
    method: 'POST',
    body: JSON.stringify({
      vector,
      limit,
      filter,
      with_payload: true,  // ← CRÍTICO: Solicitar el payload
      with_vector: false   // ← Optimización: No necesitamos el vector de vuelta
    }),
  });
  return (res as any)?.result || [];
}

/**
 * Get all points from a collection with their vectors and payloads
 * Uses scroll API to handle large collections
 */
export async function getAllPointsFromCollection(
  collectionName: string,
  limit: number = 1000
): Promise<Array<{ id: string | number; vector: number[]; payload?: Record<string, any> }>> {
  const allPoints: Array<{ id: string | number; vector: number[]; payload?: Record<string, any> }> = [];
  let offset: string | number | null = null;

  while (true) {
    const body: any = {
      limit,
      with_payload: true,
      with_vector: true,
    };

    if (offset !== null) {
      body.offset = offset;
    }

    const res = await qdrantFetch<{
      result: {
        points: Array<{ id: string | number; vector: number[]; payload?: Record<string, any> }>;
        next_page_offset?: string | number | null;
      };
    }>({
      path: `/collections/${collectionName}/points/scroll`,
      method: 'POST',
      body: JSON.stringify(body),
    });

    const points = (res as any)?.result?.points || [];
    allPoints.push(...points);

    const nextOffset = (res as any)?.result?.next_page_offset;
    if (!nextOffset || points.length === 0) {
      break;
    }
    offset = nextOffset;
  }

  return allPoints;
}

export async function deleteCollection(collectionName: string): Promise<void> {
  try {
    await qdrantFetch({ path: `/collections/${collectionName}`, method: 'DELETE', skipJson: true, allowStatuses: [404] });
  } catch (e) {
    // ignore
  }
}

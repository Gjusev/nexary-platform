const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

export const EMBEDDING_VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE ?? 1536);
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
      allowStatuses: [409],
      skipJson: true,
    });
  } catch (error) {
    if (error instanceof QdrantError && error.status === 409) {
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
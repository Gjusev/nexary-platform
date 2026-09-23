import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PREFERENCES = {
  theme: 'system',
  language: 'de',
  timezone: 'Europe/Berlin',
  dateFormat: 'dd-mm-yyyy',
} as const;

type PreferenceKey = keyof typeof DEFAULT_PREFERENCES;

type Preferences = Record<PreferenceKey, string>;

type PartialPreferences = Partial<Preferences>;

function sanitizePreferences(input: unknown): PartialPreferences {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const updates: PartialPreferences = {};

  for (const key of Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      updates[key] = value;
    }
  }

  return updates;
}

function mergePreferences(
  current: PartialPreferences | undefined
): Preferences {
  const base: Preferences = { ...DEFAULT_PREFERENCES };

  if (!current) {
    return base;
  }

  for (const key of Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]) {
    const value = current[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      base[key] = value;
    }
  }

  return base;
}

export async function GET() {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const metadata = ((user as any).serverMetadata || {}) as Record<string, unknown>;
    const currentPreferences = sanitizePreferences(metadata.preferences);

    return NextResponse.json(mergePreferences(currentPreferences));
  } catch (error) {
    console.error('Error al obtener preferencias:', error);
    return NextResponse.json(
      { error: 'No se pudieron obtener las preferencias' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const updates = sanitizePreferences(body);

    const currentMetadata = ((user as any).serverMetadata || {}) as Record<string, unknown>;
    const currentPreferences = sanitizePreferences(currentMetadata.preferences);

    const mergedPreferences = mergePreferences({
      ...currentPreferences,
      ...updates,
    });

    await (user as any).update?.({
      serverMetadata: {
        ...currentMetadata,
        preferences: mergedPreferences,
      },
    });

    return NextResponse.json(mergedPreferences);
  } catch (error) {
    console.error('Error al actualizar preferencias:', error);
    return NextResponse.json(
      { error: 'No se pudieron actualizar las preferencias' },
      { status: 500 }
    );
  }
}

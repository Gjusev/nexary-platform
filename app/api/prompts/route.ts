import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { PromptsDB } from '@/lib/prompts-db';
import { ensurePromptsTable } from '@/lib/prompts-schema';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

// Ensure tables are created
let tablesInitialized = false;

async function ensureTables() {
  if (!tablesInitialized) {
    await ensurePromptsTable();
    tablesInitialized = true;
  }
}

export async function GET(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await ensureTables();

    const user = await stackServerApp.getUser();
    if (!user || user === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const visibility = searchParams.get('visibility') as 'private' | 'team' | 'community' | null;
    const search = searchParams.get('search');
    const teamSlug = searchParams.get('teamSlug');

    let prompts;

    if (search) {
      prompts = await PromptsDB.searchPrompts(
        user.id,
        search,
        teamSlug || undefined,
        visibility || undefined
      );
    } else {
      prompts = await PromptsDB.getPrompts(
        user.id,
        teamSlug || undefined,
        visibility || undefined
      );
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await ensureTables();

    const user = await stackServerApp.getUser();
    if (!user || user === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, description, visibility, teamSlug, category, tags } = body;

    if (!title || !content || !visibility) {
      return NextResponse.json(
        { error: 'Title, content, and visibility are required' },
        { status: 400 }
      );
    }

    if (visibility !== 'private' && visibility !== 'team' && visibility !== 'community') {
      return NextResponse.json(
        { error: 'Invalid visibility level' },
        { status: 400 }
      );
    }

    if (visibility === 'team' && !teamSlug) {
      return NextResponse.json(
        { error: 'Team slug is required for team prompts' },
        { status: 400 }
      );
    }

    const prompt = await PromptsDB.createPrompt({
      title,
      content,
      description,
      visibility,
      userId: user.id,
      username: user.displayName || undefined,
      teamSlug: teamSlug || undefined,
      category,
      tags,
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}

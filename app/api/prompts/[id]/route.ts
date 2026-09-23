import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { PromptsDB } from '@/lib/prompts-db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await stackServerApp.getUser();
    if (!user || user === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, content, description, visibility, teamSlug, category, tags } = body;

    const prompt = await PromptsDB.updatePrompt(id, user.id, {
      title,
      content,
      description,
      visibility,
      teamSlug,
      category,
      tags,
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error updating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await stackServerApp.getUser();
    if (!user || user === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const success = await PromptsDB.deletePrompt(id, user.id);

    if (!success) {
      return NextResponse.json({ error: 'Prompt not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}

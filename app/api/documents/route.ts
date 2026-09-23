/**
 * Document Hub API - List and Create Master Documents
 * GET /api/documents - List all documents for the team
 * POST /api/documents - Upload a new document to the hub
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    listMasterDocuments,
    createMasterDocument,
    getAllTags
} from '@/lib/rag/master-document-store';
import { getStackServerAppFromCookies } from '@/lib/rag/auth-helpers';
import { extractTextFromBuffer } from '@/lib/rag/text-extract';
import { processRagAssignment } from '@/lib/rag/document-processor';
import type { DocumentFilters, RagDocumentStatus } from '@/lib/rag/types';
import { checkDocumentsRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = getStackServerAppFromCookies();

export async function GET(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkDocumentsRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const user = await stackServerApp.getUser({ or: 'return-null' });
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam) {
            return NextResponse.json({ success: false, error: 'No team found' }, { status: 400 });
        }

        const teamId = selectedTeam.id;

        const { searchParams } = new URL(request.url);

        const filters: DocumentFilters = {
            search: searchParams.get('search') || undefined,
            status: (searchParams.get('status') as RagDocumentStatus | 'all') || 'all',
            tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
            ragPackageId: searchParams.get('ragPackageId') || undefined,
            showArchived: searchParams.get('showArchived') === 'true',
        };

        const { documents, total } = await listMasterDocuments(teamId, filters);
        const allTags = await getAllTags(teamId);

        return NextResponse.json({
            success: true,
            documents,
            total,
            allTags,
        });
    } catch (error) {
        console.error('Error listing documents:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to list documents' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkDocumentsRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const user = await stackServerApp.getUser({ or: 'return-null' });
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam) {
            return NextResponse.json({ success: false, error: 'No team found' }, { status: 400 });
        }

        const teamId = selectedTeam.id;

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const tagsStr = formData.get('tags') as string | null;
        const ragPackageIds = formData.get('ragPackageIds') as string | null;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        // Extract text
        let extractedText = '';
        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            extractedText = await extractTextFromBuffer(buffer, { contentType: file.type, filename: file.name }) ?? '';
        } catch (error) {
            console.error('Failed to extract text:', error);
            // We continue creating the document even if extraction fails, but status might be affected or warned
        }

        // Create unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.name}`;
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

        // Create document record
        const document = await createMasterDocument({
            teamSlug: teamId,
            userId: user.id,
            filename,
            originalFilename: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            tags,
            status: 'ready',
            extractedText, // Store extracted text
        });

        // If ragPackageIds provided, assign to those RAGs and process
        if (ragPackageIds) {
            const { assignDocumentToRags } = await import('@/lib/rag/master-document-store');
            const ragIds = ragPackageIds.split(',').filter(Boolean);
            if (ragIds.length > 0) {
                await assignDocumentToRags(document.id, ragIds, user.id);

                // Trigger processing if we have text
                if (extractedText) {
                    // Process in parallel
                    await Promise.all(ragIds.map(ragId =>
                        processRagAssignment(document, ragId, extractedText)
                    ));
                }
            }
        }

        return NextResponse.json({
            success: true,
            document,
        });
    } catch (error) {
        console.error('Error creating document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create document' },
            { status: 500 }
        );
    }
}

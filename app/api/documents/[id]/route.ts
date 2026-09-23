/**
 * Document Hub API - Single Document Operations
 * GET /api/documents/[id] - Get document details
 * PATCH /api/documents/[id] - Update document
 * DELETE /api/documents/[id] - Delete document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStackServerAppFromCookies } from '@/lib/rag/auth-helpers';
import {
    getMasterDocumentById,
    updateMasterDocument,
    deleteMasterDocument,
    getDocumentAssignments
} from '@/lib/rag/master-document-store';
import { processRagAssignment } from '@/lib/rag/document-processor';
import { checkDocumentsRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = getStackServerAppFromCookies();

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const document = await getMasterDocumentById(id);

        if (!document) {
            return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
        }

        // Verify team access
        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam || document.teamSlug !== selectedTeam.id) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        return NextResponse.json({
            success: true,
            document,
        });
    } catch (error) {
        console.error('Error getting document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get document' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const document = await getMasterDocumentById(id);

        if (!document) {
            return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
        }

        // Verify team access
        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam || document.teamSlug !== selectedTeam.id) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { tags, archived, extractedText } = body;

        const updates: Parameters<typeof updateMasterDocument>[1] = {};

        if (tags !== undefined) {
            updates.tags = Array.isArray(tags) ? tags : [];
        }

        if (archived !== undefined) {
            updates.archivedAt = archived ? new Date().toISOString() : null;
        }

        if (extractedText !== undefined) {
            updates.extractedText = extractedText;
        }

        const updatedDocument = await updateMasterDocument(id, updates);

        if (extractedText !== undefined && updatedDocument) {
            const assignments = await getDocumentAssignments(id);
            const ragAssignments = assignments.filter(a => a.ragPackageId);

            if (ragAssignments.length > 0) {
                // Trigger re-processing in background
                Promise.all(ragAssignments.map(a =>
                    processRagAssignment(document, a.ragPackageId, extractedText)
                )).catch(err => console.error('Background re-processing failed:', err));
            }
        }

        return NextResponse.json({
            success: true,
            document: updatedDocument,
        });
    } catch (error) {
        console.error('Error updating document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update document' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const document = await getMasterDocumentById(id);

        if (!document) {
            return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
        }

        // Verify team access
        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam || document.teamSlug !== selectedTeam.id) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const hard = searchParams.get('hard') === '1';

        await deleteMasterDocument(id, hard);

        return NextResponse.json({
            success: true,
            message: hard ? 'Document permanently deleted' : 'Document moved to trash',
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete document' },
            { status: 500 }
        );
    }
}

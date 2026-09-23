/**
 * Document Hub API - RAG Assignments
 * GET /api/documents/[id]/assignments - List RAG assignments
 * POST /api/documents/[id]/assignments - Assign to RAGs
 * DELETE /api/documents/[id]/assignments - Remove from RAGs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStackServerAppFromCookies } from '@/lib/rag/auth-helpers';
import {
    getMasterDocumentById,
    getDocumentAssignments,
    assignDocumentToRags,
    removeDocumentFromRags
} from '@/lib/rag/master-document-store';
import { processRagAssignment } from '@/lib/rag/document-processor';

const stackServerApp = getStackServerAppFromCookies();

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam || document.teamSlug !== selectedTeam.id) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        const assignments = await getDocumentAssignments(id);

        return NextResponse.json({
            success: true,
            assignments,
        });
    } catch (error) {
        console.error('Error getting assignments:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get assignments' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam || document.teamSlug !== selectedTeam.id) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { ragPackageIds } = body;

        if (!Array.isArray(ragPackageIds) || ragPackageIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ragPackageIds array required' },
                { status: 400 }
            );
        }

        const assignments = await assignDocumentToRags(id, ragPackageIds, user.id);

        // Trigger processing if we have text
        if (document.extractedText) {
            // Process in parallel
            await Promise.all(ragPackageIds.map((ragId: string) =>
                processRagAssignment(document, ragId, document.extractedText!)
            ));
        }

        return NextResponse.json({
            success: true,
            assignments,
            message: `Document assigned to ${ragPackageIds.length} RAG package(s)`,
        });
    } catch (error) {
        console.error('Error assigning document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to assign document' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const teams = await (user as any).listTeams?.() || [];
        const selectedTeam = (user as any).selectedTeam || teams[0];

        if (!selectedTeam || document.teamSlug !== selectedTeam.id) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { ragPackageIds } = body;

        if (!Array.isArray(ragPackageIds) || ragPackageIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ragPackageIds array required' },
                { status: 400 }
            );
        }

        const { deleted } = await removeDocumentFromRags(id, ragPackageIds);

        return NextResponse.json({
            success: true,
            deleted,
            message: `Document removed from ${deleted} RAG package(s)`,
        });
    } catch (error) {
        console.error('Error removing document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to remove document from RAGs' },
            { status: 500 }
        );
    }
}

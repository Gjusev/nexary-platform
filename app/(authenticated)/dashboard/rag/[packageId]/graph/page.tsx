"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import MindMapViewer from '@/components/rag/mindmap-viewer';
import DocumentDetailPanel from '@/components/rag/document-detail-panel';
import MindMapControls from '@/components/rag/mindmap-controls';

export default function MindMapPage() {
    const router = useRouter();
    const params = useParams();
    const packageId = params.packageId as string;

    const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
    const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
    const [viewMode, setViewMode] = useState<'chunks' | 'documents'>('chunks');
    const [packageName, setPackageName] = useState('RAG Package');

    const handleNodeClick = (nodeData: any) => {
        setSelectedNodeData(nodeData);
    };

    const handleClosePanel = () => {
        setSelectedNodeData(null);
    };

    const handleApplySettings = (threshold: number, mode: 'chunks' | 'documents') => {
        setSimilarityThreshold(threshold);
        setViewMode(mode);
    };

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="border-b border-border bg-background px-4 py-3 flex items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/dashboard/rag')}
                        title="Back to RAG Dashboard"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-semibold">Knowledge Graph</h1>
                        <p className="text-sm text-muted-foreground">{packageName}</p>
                    </div>
                </div>

                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Settings2 className="h-4 w-4 mr-2" />
                            Settings
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Mindmap Settings</SheetTitle>
                            <SheetDescription>
                                Adjust visualization parameters to explore relationships
                            </SheetDescription>
                        </SheetHeader>
                        <div className="mt-6">
                            <MindMapControls
                                similarityThreshold={similarityThreshold}
                                onSimilarityChange={(value) => {
                                    setSimilarityThreshold(value);
                                }}
                                viewMode={viewMode}
                                onViewModeChange={(mode) => {
                                    setViewMode(mode);
                                }}
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            </header>

            {/* Main content */}
            <main className="flex-1 relative overflow-hidden">
                <MindMapViewer
                    packageId={packageId}
                    packageName={packageName}
                    onNodeClick={handleNodeClick}
                    similarityThreshold={similarityThreshold}
                    viewMode={viewMode}
                />

                {/* Detail panel */}
                {selectedNodeData && viewMode === 'chunks' && (
                    <DocumentDetailPanel
                        packageId={packageId}
                        chunkId={selectedNodeData.documentId || null}
                        documentData={selectedNodeData}
                        onClose={handleClosePanel}
                    />
                )}
            </main>
        </div>
    );
}

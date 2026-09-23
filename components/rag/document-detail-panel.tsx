"use client";

import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface DocumentDetailPanelProps {
    packageId: string;
    chunkId: string | null;
    documentData?: any;
    onClose: () => void;
    onNavigate?: (chunkId: string) => void;
}

export default function DocumentDetailPanel({
    packageId,
    chunkId,
    documentData,
    onClose,
    onNavigate,
}: DocumentDetailPanelProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!chunkId) {
            setData(null);
            return;
        }

        // If documentData is provided directly, use it
        if (documentData) {
            setData({
                chunk: {
                    id: chunkId,
                    content: documentData.content,
                    chunkIndex: documentData.chunkIndex,
                    documentId: documentData.documentId,
                },
                document: {
                    filename: documentData.filename,
                },
                navigation: {
                    previous: null,
                    next: null,
                },
            });
            return;
        }

        // Otherwise fetch from API
        const fetchChunkDetails = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/rag/mindmap/${packageId}/chunk/${chunkId}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.error || 'Failed to load chunk details');
                }

                setData(result);
            } catch (err) {
                console.error('Error fetching chunk details:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchChunkDetails();
    }, [chunkId, packageId, documentData]);

    if (!chunkId) {
        return null;
    }

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-lg">Document Details</h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4">
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : error ? (
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive text-sm">Error</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{error}</p>
                        </CardContent>
                    </Card>
                ) : data ? (
                    <div className="space-y-4">
                        {/* Document info */}
                        {data.document && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <CardTitle className="text-sm">{data.document.filename}</CardTitle>
                                    </div>
                                    {data.document.totalChunks && (
                                        <CardDescription>
                                            Total chunks: {data.document.totalChunks}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                            </Card>
                        )}

                        {/* Chunk info */}
                        {data.chunk && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm">Chunk #{data.chunk.chunkIndex}</CardTitle>
                                        <Badge variant="outline">{data.chunk.id.substring(0, 8)}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <p className="text-sm whitespace-pre-wrap">{data.chunk.content}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Metadata */}
                        {data.chunk?.metadata && Object.keys(data.chunk.metadata).length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Metadata</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <dl className="space-y-2 text-xs">
                                        {Object.entries(data.chunk.metadata)
                                            .filter(([key]) => !['text', 'document_id', 'chunk_index'].includes(key))
                                            .map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <dt className="text-muted-foreground">{key}:</dt>
                                                    <dd className="font-medium">{String(value)}</dd>
                                                </div>
                                            ))}
                                    </dl>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                ) : null}
            </ScrollArea>

            {/* Navigation */}
            {data?.navigation && (data.navigation.previous || data.navigation.next) && (
                <div className="p-4 border-t border-border bg-muted/30">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={!data.navigation.previous}
                            onClick={() => {
                                if (data.navigation.previous && onNavigate) {
                                    onNavigate(data.navigation.previous.id);
                                }
                            }}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={!data.navigation.next}
                            onClick={() => {
                                if (data.navigation.next && onNavigate) {
                                    onNavigate(data.navigation.next.id);
                                }
                            }}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

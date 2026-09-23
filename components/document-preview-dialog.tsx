
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Pencil, Save, X, FileText, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatFileSize } from '@/lib/utils';
import type { MasterDocument } from '@/lib/rag/types';
import { useToast } from '@/hooks/use-toast';

interface DocumentPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentId: string;
}

export function DocumentPreviewDialog({
    open,
    onOpenChange,
    documentId
}: DocumentPreviewDialogProps) {
    const t = useTranslations('dashboard.documentsPage');
    const { toast } = useToast();
    const [document, setDocument] = useState<MasterDocument | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && documentId) {
            fetchDocument();
            setIsEditing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, documentId]);

    const fetchDocument = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/documents/${documentId}`);
            const data = await res.json();
            if (res.ok && data.success) {
                setDocument(data.document);
                setEditedText(data.document.extractedText || '');
            } else {
                toast({
                    title: 'Error',
                    description: data.error || 'Failed to load document',
                    variant: 'destructive'
                });
                onOpenChange(false);
            }
        } catch (error) {
            console.error('Error fetching document:', error);
            toast({
                title: 'Error',
                description: 'Failed to load document',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!document) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/documents/${document.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extractedText: editedText })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setDocument(data.document);
                setIsEditing(false);
                toast({ title: 'Success', description: 'contentUpdated' }); // Using placeholder key
            } else {
                toast({ title: 'Error', description: 'updateFailed', variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'updateFailed', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="flex items-center justify-between">
                        <span className="truncate max-w-[500px]" title={document?.originalFilename}>
                            {document?.originalFilename || 'Document Preview'}
                        </span>
                        {/* Actions in header */}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : document ? (
                        <Tabs defaultValue="content" className="h-full flex flex-col">
                            <div className="px-6 border-b flex items-center justify-between bg-muted/40">
                                <TabsList className="h-10 bg-transparent p-0">
                                    <TabsTrigger
                                        value="content"
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 pt-3"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Content
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="details"
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 pt-3"
                                    >
                                        <Info className="w-4 h-4 mr-2" />
                                        Details
                                    </TabsTrigger>
                                </TabsList>

                                <div className="flex items-center gap-2 py-2">
                                    {isEditing ? (
                                        <>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setIsEditing(false);
                                                setEditedText(document.extractedText || '');
                                            }} disabled={saving}>
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={handleSave} disabled={saving}>
                                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                            <Pencil className="w-3 h-3 mr-2" />
                                            Edit Content
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <TabsContent value="content" className="flex-1 p-0 m-0 overflow-hidden relative">
                                {isEditing ? (
                                    <Textarea
                                        value={editedText}
                                        onChange={(e) => setEditedText(e.target.value)}
                                        className="w-full h-full resize-none p-6 border-0 focus-visible:ring-0 rounded-none font-mono text-sm leading-relaxed"
                                        placeholder="No text extracted from this document."
                                    />
                                ) : (
                                    <ScrollArea className="h-full w-full">
                                        <div className="p-6 whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/80">
                                            {document.extractedText || <span className="text-muted-foreground italic">No extracted text available.</span>}
                                        </div>
                                    </ScrollArea>
                                )}
                            </TabsContent>

                            <TabsContent value="details" className="flex-1 overflow-auto p-6 m-0">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-6 max-w-2xl">
                                    <div>
                                        <Label className="text-muted-foreground">Original Filename</Label>
                                        <div className="font-medium mt-1 truncate" title={document.originalFilename}>{document.originalFilename}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Size</Label>
                                        <div className="font-medium mt-1">{formatFileSize(document.size)}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Type</Label>
                                        <div className="font-medium mt-1">{document.contentType}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Status</Label>
                                        <div className="mt-1 capitalize">{document.status}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Upload Date</Label>
                                        <div className="font-medium mt-1">{new Date(document.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">SHA256</Label>
                                        <div className="font-mono text-xs mt-1 break-all text-muted-foreground">{document.sha256 || 'N/A'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-muted-foreground block mb-2">Assigned RAG Packages</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {document.ragAssignments?.map(a => (
                                                <Badge key={a.id} variant="secondary">
                                                    {a.ragPackageName}
                                                </Badge>
                                            ))}
                                            {(!document.ragAssignments || document.ragAssignments.length === 0) && (
                                                <span className="text-sm text-muted-foreground italic">No assignments</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

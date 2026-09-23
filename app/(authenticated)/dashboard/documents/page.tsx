"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
    FileText, Search, Filter, Grid, List, Plus, Tag,
    Archive, Trash2, MoreHorizontal, CheckSquare, Square,
    Database, X, Upload, LayoutGrid, Table as TableIcon, Eye
} from 'lucide-react';

import { useTeam } from '@/hooks/use-team';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { MasterDocument, DocumentRagAssignment } from '@/lib/rag/types';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ManageTagsDialog } from '@/components/manage-tags-dialog';
import { DocumentPreviewDialog } from '@/components/document-preview-dialog';
import { formatFileSize } from '@/lib/utils';

type ViewMode = 'grid' | 'list' | 'compact';

interface RagPackage {
    id: string;
    name: string;
    description?: string;
}

export default function DocumentHubPage() {
    const { isOwner, teamSlug } = useTeam();
    const { toast } = useToast();
    const t = useTranslations('dashboard.documentsPage');
    const tCommon = useTranslations('common');

    const [documents, setDocuments] = useState<MasterDocument[]>([]);
    const [ragPackages, setRagPackages] = useState<RagPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assigningDocIds, setAssigningDocIds] = useState<string[]>([]);
    const [manageTagsOpen, setManageTagsOpen] = useState(false);
    const [managingDocId, setManagingDocId] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewDocId, setPreviewDocId] = useState<string | null>(null);
    const [allTags, setAllTags] = useState<string[]>([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('search', searchQuery);

            const res = await fetch(`/api/documents?${params.toString()}`);
            const data = await res.json();

            if (res.ok && data.success) {
                setDocuments(data.documents || []);
                setAllTags(data.allTags || []);
            } else {
                toast({
                    title: t('loadError'),
                    description: data.error || t('couldNotLoadDocuments'),
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Failed to fetch documents:', error);
            toast({
                title: t('connectionError'),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [searchQuery, t, toast]);

    const fetchRagPackages = useCallback(async () => {
        try {
            const res = await fetch('/api/rag/packages');
            const data = await res.json();
            if (res.ok && data.success) {
                setRagPackages(data.packages || []);
            }
        } catch (error) {
            console.error('Failed to fetch RAG packages:', error);
        }
    }, []);

    useEffect(() => {
        if (isOwner) {
            fetchDocuments();
            fetchRagPackages();
        }
    }, [isOwner, fetchDocuments, fetchRagPackages]);

    const toggleSelectDoc = (docId: string) => {
        setSelectedDocs(prev => {
            const next = new Set(prev);
            if (next.has(docId)) {
                next.delete(docId);
            } else {
                next.add(docId);
            }
            return next;
        });
    };

    const selectAllDocs = () => {
        if (selectedDocs.size === documents.length) {
            setSelectedDocs(new Set());
        } else {
            setSelectedDocs(new Set(documents.map(d => d.id)));
        }
    };

    const handleAssignToRag = async (docIds: string[], ragIds: string[]) => {
        let successCount = 0;
        let errorCount = 0;

        // Process each document
        for (const docId of docIds) {
            try {
                const res = await fetch(`/api/documents/${docId}/assignments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ragPackageIds: ragIds }),
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to assign doc ${docId}:`, data.error);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error assigning doc ${docId}:`, error);
            }
        }

        if (successCount > 0) {
            toast({
                title: t('assignmentSuccess'),
                description: `${successCount} documento(s) asignado(s) correctamente${errorCount > 0 ? `, ${errorCount} fallaron` : ''}`
            });
            fetchDocuments();
        } else {
            toast({ title: t('assignmentError'), variant: 'destructive' });
        }

        setAssignModalOpen(false);
        setAssigningDocIds([]);
        setSelectedDocs(new Set());
    };

    const handleTagsUpdated = useCallback((newTags: string[]) => {
        if (!managingDocId) return;
        setDocuments(prev => prev.map(d => d.id === managingDocId ? { ...d, tags: newTags } : d));
    }, [managingDocId]);

    const handleRemoveFromRag = async (docId: string, ragIds: string[]) => {
        try {
            const res = await fetch(`/api/documents/${docId}/assignments`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ragPackageIds: ragIds }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                toast({ title: t('removalSuccess'), description: data.message });
                fetchDocuments();
            } else {
                toast({ title: t('removalError'), variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: t('connectionError'), variant: 'destructive' });
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!confirm(t('confirmDelete'))) return;

        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            const data = await res.json();

            if (res.ok && data.success) {
                toast({ title: t('documentDeleted') });
                setDocuments(prev => prev.filter(d => d.id !== docId));
            } else {
                toast({ title: t('deleteError'), variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: t('connectionError'), variant: 'destructive' });
        }
    };



    const getFileIcon = (contentType: string, filename: string) => {
        if (contentType.includes('pdf') || filename.endsWith('.pdf')) return '📄';
        if (contentType.includes('word') || filename.match(/\.docx?$/)) return '📝';
        if (contentType.includes('json') || filename.endsWith('.json')) return '📋';
        if (contentType.includes('markdown') || filename.endsWith('.md')) return '📑';
        return '📄';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'processing':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t('statusProcessing')}</Badge>;
            case 'ready':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t('statusReady')}</Badge>;
            case 'failed':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{t('statusFailed')}</Badge>;
            default:
                return null;
        }
    };

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('accessRestricted')}</CardTitle>
                            <CardDescription>{t('noPermission')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard" className="underline hover:text-foreground">
                                {t('backToDashboard')}
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-background sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                                <FileText className="h-6 w-6" />
                                {t('title')}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t('description')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={() => setUploadDialogOpen(true)}>
                                <Upload className="h-4 w-4 mr-2" />
                                {t('uploadDocument')}
                            </Button>
                            <Link href="/dashboard/rag">
                                <Button variant="outline">
                                    <Database className="h-4 w-4 mr-2" />
                                    {t('manageRags')}
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'outline'}
                                size="icon"
                                onClick={() => setViewMode('grid')}
                                title={t('gridView')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'outline'}
                                size="icon"
                                onClick={() => setViewMode('list')}
                                title={t('listView')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'compact' ? 'default' : 'outline'}
                                size="icon"
                                onClick={() => setViewMode('compact')}
                                title={t('compactView')}
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Bulk Actions */}
                    {selectedDocs.size > 0 && (
                        <div className="flex items-center gap-4 mt-4 p-3 bg-muted rounded-lg">
                            <span className="text-sm text-muted-foreground">
                                {t('selectedCount', { count: selectedDocs.size })}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setAssigningDocIds(Array.from(selectedDocs));
                                    setAssignModalOpen(true);
                                }}
                            >
                                <Database className="h-4 w-4 mr-2" />
                                {t('assignToRag')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDocs(new Set())}
                            >
                                {t('clearSelection')}
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {loading ? (
                    <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <Skeleton className="h-4 w-3/4 mb-2" />
                                    <Skeleton className="h-3 w-1/2" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">{t('noDocuments')}</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {t('uploadFirst')}
                            </p>
                            <Link href="/dashboard/rag">
                                <Button>
                                    <Upload className="h-4 w-4 mr-2" />
                                    {t('goToRag')}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : viewMode === 'grid' ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {documents.map(doc => (
                            <Card
                                key={doc.id}
                                className={`relative transition-all ${selectedDocs.has(doc.id) ? 'ring-2 ring-primary' : ''}`}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={selectedDocs.has(doc.id)}
                                                onCheckedChange={() => toggleSelectDoc(doc.id)}
                                            />
                                            <span className="text-2xl">{getFileIcon(doc.contentType, doc.filename)}</span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setPreviewDocId(doc.id);
                                                    setPreviewOpen(true);
                                                }}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    {t('preview')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                    setAssigningDocIds([doc.id]);
                                                    setAssignModalOpen(true);
                                                }}>
                                                    <Database className="h-4 w-4 mr-2" />
                                                    {t('manageAssignments')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                    setManagingDocId(doc.id);
                                                    setManageTagsOpen(true);
                                                }}>
                                                    <Tag className="h-4 w-4 mr-2" />
                                                    {t('manageTags')}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    {t('delete')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <CardTitle className="text-sm font-medium truncate" title={doc.originalFilename}>
                                        {doc.originalFilename}
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {formatFileSize(doc.size)} • {new Date(doc.createdAt).toLocaleDateString()}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {getStatusBadge(doc.status)}
                                        {doc.tags?.slice(0, 2).map(tag => (
                                            <Badge key={tag} variant="secondary" className="text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                        {(doc.tags?.length || 0) > 2 && (
                                            <Badge variant="secondary" className="text-xs">
                                                +{doc.tags!.length - 2}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* RAG Assignments */}
                                    <div className="mt-3 pt-3 border-t border-border">
                                        <p className="text-xs text-muted-foreground mb-1">{t('assignedTo')}:</p>
                                        {doc.ragAssignments && doc.ragAssignments.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {doc.ragAssignments.map(assignment => (
                                                    <Badge
                                                        key={assignment.id}
                                                        variant="outline"
                                                        className="text-xs flex items-center gap-1"
                                                    >
                                                        <Database className="h-3 w-3" />
                                                        {assignment.ragPackageName}
                                                        <button
                                                            onClick={() => handleRemoveFromRag(doc.id, [assignment.ragPackageId])}
                                                            className="ml-1 hover:text-destructive"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">{t('notAssigned')}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : viewMode === 'compact' ? (
                    <div className="border rounded-lg overflow-hidden bg-card">
                        <table className="w-full text-sm">
                            <thead className="bg-muted text-muted-foreground border-b border-border">
                                <tr>
                                    <th className="p-3 w-10 text-center">
                                        <Checkbox
                                            checked={selectedDocs.size === documents.length && documents.length > 0}
                                            onCheckedChange={selectAllDocs}
                                        />
                                    </th>
                                    <th className="p-3 text-left font-medium">{t('filename')}</th>
                                    <th className="p-3 text-left font-medium w-24">{t('size')}</th>
                                    <th className="p-3 text-left font-medium w-32">{t('status')}</th>
                                    <th className="p-3 text-left font-medium w-48">{t('assignments')}</th>
                                    <th className="p-3 text-right font-medium w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {documents.map(doc => (
                                    <tr key={doc.id} className={`group hover:bg-muted/50 ${selectedDocs.has(doc.id) ? 'bg-muted/50' : ''}`}>
                                        <td className="p-3 text-center">
                                            <Checkbox
                                                checked={selectedDocs.has(doc.id)}
                                                onCheckedChange={() => toggleSelectDoc(doc.id)}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2 max-w-[300px] lg:max-w-md">
                                                <span className="text-lg flex-shrink-0">{getFileIcon(doc.contentType, doc.filename)}</span>
                                                <span className="truncate" title={doc.originalFilename}>
                                                    {doc.originalFilename}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                                            {formatFileSize(doc.size)}
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            {getStatusBadge(doc.status)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {doc.ragAssignments?.slice(0, 1).map(a => (
                                                    <Badge key={a.id} variant="outline" className="text-xs h-5 px-1.5 font-normal">
                                                        {a.ragPackageName}
                                                    </Badge>
                                                ))}
                                                {(doc.ragAssignments?.length || 0) > 1 && (
                                                    <span className="text-xs text-muted-foreground pl-1">
                                                        +{doc.ragAssignments!.length - 1}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setPreviewDocId(doc.id);
                                                        setPreviewOpen(true);
                                                    }}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        {t('preview')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setAssigningDocIds([doc.id]);
                                                        setAssignModalOpen(true);
                                                    }}>
                                                        <Database className="h-4 w-4 mr-2" />
                                                        {t('manageAssignments')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setManagingDocId(doc.id);
                                                        setManageTagsOpen(true);
                                                    }}>
                                                        <Tag className="h-4 w-4 mr-2" />
                                                        {t('manageTags')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        {t('delete')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* List Header */}
                        <div className="flex items-center gap-4 px-4 py-2 bg-muted rounded-lg text-sm font-medium text-muted-foreground">
                            <Checkbox
                                checked={selectedDocs.size === documents.length && documents.length > 0}
                                onCheckedChange={selectAllDocs}
                            />
                            <span className="flex-1">{t('filename')}</span>
                            <span className="w-32">{t('tags')}</span>
                            <span className="w-24">{t('size')}</span>
                            <span className="w-32">{t('status')}</span>
                            <span className="w-48">{t('assignments')}</span>
                            <span className="w-20">{t('actions')}</span>
                        </div>

                        {documents.map(doc => (
                            <div
                                key={doc.id}
                                className={`flex items-center gap-4 px-4 py-3 bg-card border rounded-lg ${selectedDocs.has(doc.id) ? 'ring-2 ring-primary' : ''
                                    }`}
                            >
                                <Checkbox
                                    checked={selectedDocs.has(doc.id)}
                                    onCheckedChange={() => toggleSelectDoc(doc.id)}
                                />
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <span className="text-lg">{getFileIcon(doc.contentType, doc.filename)}</span>
                                    <span className="truncate" title={doc.originalFilename}>
                                        {doc.originalFilename}
                                    </span>
                                </div>
                                <div className="w-32 flex flex-wrap gap-1 content-center">
                                    {doc.tags?.slice(0, 2).map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1">
                                            {tag}
                                        </Badge>
                                    ))}
                                    {(doc.tags?.length || 0) > 2 && (
                                        <span className="text-xs text-muted-foreground">+{doc.tags!.length - 2}</span>
                                    )}
                                </div>
                                <span className="w-24 text-sm text-muted-foreground">
                                    {formatFileSize(doc.size)}
                                </span>
                                <div className="w-32">
                                    {getStatusBadge(doc.status)}
                                </div>
                                <div className="w-48 flex flex-wrap gap-1">
                                    {doc.ragAssignments?.slice(0, 2).map(a => (
                                        <Badge key={a.id} variant="outline" className="text-xs">
                                            {a.ragPackageName}
                                        </Badge>
                                    ))}
                                    {(doc.ragAssignments?.length || 0) > 2 && (
                                        <Badge variant="secondary" className="text-xs">
                                            +{doc.ragAssignments!.length - 2}
                                        </Badge>
                                    )}
                                    {(!doc.ragAssignments || doc.ragAssignments.length === 0) && (
                                        <span className="text-xs text-muted-foreground italic">{t('none')}</span>
                                    )}
                                </div>
                                <div className="w-20">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                setPreviewDocId(doc.id);
                                                setPreviewOpen(true);
                                            }}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                {t('preview')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                                setAssigningDocIds([doc.id]);
                                                setAssignModalOpen(true);
                                            }}>
                                                <Database className="h-4 w-4 mr-2" />
                                                {t('manageAssignments')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                                setManagingDocId(doc.id);
                                                setManageTagsOpen(true);
                                            }}>
                                                <Tag className="h-4 w-4 mr-2" />
                                                {t('manageTags')}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => handleDeleteDocument(doc.id)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                {t('delete')}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Assignment Modal */}
            <AssignmentModal
                open={assignModalOpen}
                onOpenChange={setAssignModalOpen}
                documentIds={assigningDocIds}
                ragPackages={ragPackages}
                currentAssignments={assigningDocIds.length === 1 ? (documents.find(d => d.id === assigningDocIds[0])?.ragAssignments || []) : []}
                onAssign={handleAssignToRag}
                onRemove={handleRemoveFromRag}
            />

            {/* Upload Dialog */}
            <UploadDocumentDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                onUploaded={fetchDocuments}
            />
            {managingDocId && (
                <ManageTagsDialog
                    open={manageTagsOpen}
                    onOpenChange={setManageTagsOpen}
                    documentId={managingDocId}
                    initialTags={documents.find(d => d.id === managingDocId)?.tags || []}
                    onTagsUpdated={handleTagsUpdated}
                />
            )}
            {previewDocId && (
                <DocumentPreviewDialog
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    documentId={previewDocId}
                />
            )}
        </div>
    );
}

// Assignment Modal Component
function AssignmentModal({
    open,
    onOpenChange,
    documentIds,
    ragPackages,
    currentAssignments,
    onAssign,
    onRemove,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentIds: string[];
    ragPackages: RagPackage[];
    currentAssignments: DocumentRagAssignment[];
    onAssign: (docIds: string[], ragIds: string[]) => void;
    onRemove: (docId: string, ragIds: string[]) => void;
}) {
    const t = useTranslations('dashboard.documentsPage');
    const [selectedRags, setSelectedRags] = useState<Set<string>>(new Set());
    const isBulkMode = documentIds.length > 1;

    useEffect(() => {
        if (open) {
            // In bulk mode, start with no selections; in single mode, use current assignments
            setSelectedRags(new Set(isBulkMode ? [] : currentAssignments.map(a => a.ragPackageId)));
        }
    }, [open, currentAssignments, isBulkMode]);

    const assignedRagIds = new Set(currentAssignments.map(a => a.ragPackageId));

    const handleSave = () => {
        if (documentIds.length === 0) return;

        const toAssign = Array.from(selectedRags).filter(id => !assignedRagIds.has(id));
        const toRemove = Array.from(assignedRagIds).filter(id => !selectedRags.has(id));

        // In bulk mode, only assign (no remove support for now)
        if (isBulkMode) {
            if (toAssign.length > 0) {
                onAssign(documentIds, toAssign);
            }
        } else {
            // Single document mode
            if (toAssign.length > 0) {
                onAssign(documentIds, toAssign);
            }
            if (toRemove.length > 0) {
                onRemove(documentIds[0], toRemove);
            }
        }

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('manageAssignments')}</DialogTitle>
                    <DialogDescription>
                        {t('selectRagsToAssign')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 max-h-64 overflow-y-auto py-4">
                    {ragPackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            {t('noRagsAvailable')}
                        </p>
                    ) : (
                        ragPackages.map(rag => (
                            <div
                                key={rag.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedRags.has(rag.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted'
                                    }`}
                                onClick={() => {
                                    setSelectedRags(prev => {
                                        const next = new Set(prev);
                                        if (next.has(rag.id)) {
                                            next.delete(rag.id);
                                        } else {
                                            next.add(rag.id);
                                        }
                                        return next;
                                    });
                                }}
                            >
                                <Checkbox checked={selectedRags.has(rag.id)} />
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{rag.name}</p>
                                    {rag.description && (
                                        <p className="text-xs text-muted-foreground">{rag.description}</p>
                                    )}
                                </div>
                                {assignedRagIds.has(rag.id) && (
                                    <Badge variant="outline" className="text-xs">
                                        {t('currentlyAssigned')}
                                    </Badge>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleSave}>
                        {t('saveAssignments')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Upload Document Dialog Component
function UploadDocumentDialog({
    open,
    onOpenChange,
    onUploaded,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploaded: () => void;
}) {
    const t = useTranslations('dashboard.documentsPage');
    const { toast } = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setProgress(0);

        try {
            const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
            let uploadedBytes = 0;
            let successCount = 0;

            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const xhr = new XMLHttpRequest();
                    await new Promise<void>((resolve, reject) => {
                        xhr.open('POST', '/api/documents');
                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                const current = uploadedBytes + e.loaded;
                                setProgress(Math.round((current / totalBytes) * 100));
                            }
                        };
                        xhr.onload = () => {
                            uploadedBytes += file.size;
                            if (xhr.status >= 200 && xhr.status < 300) {
                                successCount++;
                                resolve();
                            } else {
                                try {
                                    const resp = JSON.parse(xhr.responseText);
                                    toast({
                                        title: t('uploadError'),
                                        description: resp.error || file.name,
                                        variant: 'destructive',
                                    });
                                } catch {
                                    // ignore
                                }
                                resolve();
                            }
                        };
                        xhr.onerror = () => {
                            uploadedBytes += file.size;
                            resolve();
                        };
                        xhr.send(formData);
                    });
                } catch (e) {
                    console.error('Upload failed:', e);
                }
            }

            if (successCount > 0) {
                toast({
                    title: t('uploadSuccess'),
                    description: t('uploadedCount', { count: successCount }),
                });
                onUploaded();
            }

            setFiles([]);
            onOpenChange(false);
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: t('uploadError'),
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    const MAX_SIZE_MB = 25;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        const valid: File[] = [];
        const rejected: string[] = [];

        for (const file of selected) {
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                rejected.push(`${file.name} (>${MAX_SIZE_MB}MB)`);
            } else {
                valid.push(file);
            }
        }

        setFiles(prev => [...prev, ...valid]);

        if (rejected.length) {
            toast({
                title: t('filesTooLarge'),
                description: rejected.join(', '),
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setFiles([]); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('uploadDocument')}</DialogTitle>
                    <DialogDescription>
                        {t('uploadDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <Input
                        type="file"
                        multiple
                        accept=".txt,.md,.json,.pdf,.doc,.docx,.pptx,.xlsx,text/plain,text/markdown,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileSelect}
                        disabled={uploading}
                    />

                    {files.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {files.map((file, index) => (
                                <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm truncate">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({(file.size / 1024).toFixed(1)} KB)
                                        </span>
                                    </div>
                                    {!uploading && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeFile(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {uploading && (
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <p className="text-sm text-center text-muted-foreground">
                                {t('uploading')} {progress}%
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
                        {uploading ? t('uploading') : t('upload')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

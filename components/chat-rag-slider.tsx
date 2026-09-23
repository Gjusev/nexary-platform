'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Database,
  Upload,
  File,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RagPackagesListSkeleton } from '@/components/chat-skeleton';

const NAVBAR_HEIGHT = 64;
const NAVBAR_OFFSET = `calc(${NAVBAR_HEIGHT}px + env(safe-area-inset-top, 0px))`;

type UploadedDocument = {
  id: string;
  name: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  chunks?: number;
};

export type RagPackage = {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  totalChunks: number;
};

interface ChatRagSliderProps {
  open: boolean;
  setOpenAction: (open: boolean) => void;
  ragPackages: RagPackage[];
  selectedPackageIds: string[];
  onTogglePackageAction: (packageId: string) => void;
  onRequestUpload: () => void;
  canManagePackages: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  conversationId?: string;
  disableInteractions?: boolean;
}

export function ChatRagSlider({
  open,
  setOpenAction,
  ragPackages,
  selectedPackageIds,
  onTogglePackageAction,
  canManagePackages,
  isUploading = false,
  uploadProgress = 0,
  conversationId,
  disableInteractions = false,
}: ChatRagSliderProps) {
  const t = useTranslations('chat');
  const { toast } = useToast();
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load existing documents when conversation changes
  useEffect(() => {
    const loadDocuments = async () => {
      if (!conversationId || !open) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/chat/documents?conversationId=${conversationId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.documents) {
            setUploadedDocs(data.documents.map((doc: any) => ({
              id: doc.id,
              name: doc.filename,
              status: 'ready' as const,
              chunks: doc.chunk_count || 0
            })));
          }
        }
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [conversationId, open]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!conversationId) {
      toast({
        title: t('error'),
        description: t('noActiveConversation'),
        variant: 'destructive',
      });
      return;
    }

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        toast({
          title: t('error'),
          description: t('notPdf', { name: file.name }),
          variant: 'destructive',
        });
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t('error'),
          description: t('tooLarge', { name: file.name }),
          variant: 'destructive',
        });
        continue;
      }

      const docId = `temp-${Date.now()}-${Math.random()}`;

      // Add to uploaded docs with uploading status
      setUploadedDocs(prev => [...prev, {
        id: docId,
        name: file.name,
        status: 'uploading'
      }]);

      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', conversationId);

        const response = await fetch('/api/chat/upload-document', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();

        // Update status to processing
        setUploadedDocs(prev => prev.map(doc =>
          doc.id === docId
            ? { ...doc, status: 'processing' as const }
            : doc
        ));

        // Wait a bit for processing (simulate)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update status to ready
        setUploadedDocs(prev => prev.map(doc =>
          doc.id === docId
            ? {
              ...doc,
              status: 'ready' as const,
              id: data.documentId,
              chunks: data.chunks
            }
            : doc
        ));

        toast({
          title: t('success'),
          description: t('processed', { name: file.name }),
        });
      } catch (error) {
        console.error('Upload error:', error);
        setUploadedDocs(prev => prev.map(doc =>
          doc.id === docId
            ? { ...doc, status: 'error' as const }
            : doc
        ));
        toast({
          title: t('error'),
          description: t('uploadFailed', { name: file.name }),
          variant: 'destructive',
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const response = await fetch(`/api/chat/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setUploadedDocs(prev => prev.filter(doc => doc.id !== docId));

      toast({
        title: t('deleted'),
        description: t('documentRemoved'),
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('deleteError'),
        variant: 'destructive',
      });
    }
  };

  const onClose = () => setOpenAction(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-black/40"
            style={{ top: 0, bottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slider */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 z-[70] flex w-full max-w-md flex-col border-l border-border shadow-2xl sm:max-w-lg bg-white dark:bg-zinc-900"
            style={{
              top: NAVBAR_OFFSET, // Keep offset for slider, but overlay is full screen
              bottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t('ragManagement')}
          >
            {/* Header with top border */}
            <div className="border-t-4 border-primary">
              <div className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <Image
                    src="/nexary-logo-long.webp"
                    alt="Nexary"
                    width={152}
                    height={32}
                    className="h-8 w-auto dark:invert"
                  />
                  <h2 className="text-lg font-semibold text-foreground">
                    {t('ragManagement')}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <Upload className="h-4 w-4" /> {t('files')}
                </Button>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Content */}
              <ScrollArea className="flex-1 border-b border-border/70 px-4 py-6 sm:px-6">
                {/* Upload Area */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    {t('uploadDocuments')}
                  </h3>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                      }`}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('dragPdfOr')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('selectFile')}
                    </Button>
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('pdfOnlyMax10mb')}
                    </p>
                  </div>
                </div>

                {/* Uploaded Documents */}
                {uploadedDocs.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-foreground mb-3">
                      {t('uploadedDocuments', { count: uploadedDocs.length })}
                    </h3>
                    <div className="space-y-2">
                      {uploadedDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate block">{doc.name}</span>
                            {doc.status === 'uploading' && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            {doc.status === 'processing' && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            {doc.status === 'ready' && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            {doc.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                          {doc.status === 'ready' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="h-8 w-8 flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>

              <div className="flex flex-1 flex-col border-t border-border/70 bg-muted/20 min-h-0">
                <ScrollArea className="flex-1 px-5 py-5 sm:px-6">
                  {loading ? (
                    <RagPackagesListSkeleton count={3} />
                  ) : ragPackages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                      <Database className="mb-4 h-10 w-10" />
                      <p>{t('noKnowledgePackages')}</p>
                      <p className="mt-1 text-xs">
                        {t('createPackagesInDashboard')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ragPackages.map((pkg) => {
                        const isSelected = selectedPackageIds.includes(pkg.id);

                        const handleToggle = () => {
                          if (!disableInteractions) {
                            onTogglePackageAction(pkg.id);
                          }
                        };

                        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                          if (disableInteractions) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleToggle();
                          }
                        };

                        return (
                          <div
                            key={pkg.id}
                            role="button"
                            tabIndex={disableInteractions ? -1 : 0}
                            onClick={handleToggle}
                            onKeyDown={handleKeyDown}
                            className={cn(
                              'group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background',
                              isSelected && 'border-primary bg-secondary/50',
                              disableInteractions && 'cursor-not-allowed opacity-60'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold leading-none text-foreground">{pkg.name}</p>
                                {pkg.description && (
                                  <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>
                                )}
                              </div>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {
                                  if (!disableInteractions) handleToggle();
                                }}
                                disabled={disableInteractions}
                                className="mt-1"
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={isSelected ? 'default' : 'outline'} className="gap-1">
                                <Database className="h-3 w-3" /> {t('documentsCount', { count: pkg.documentCount })}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                <FileText className="h-3 w-3" /> {t('chunksCount', { count: pkg.totalChunks })}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Footer with bottom border */}
              <div className="border-b-4 border-primary">
                <div
                  className="p-4 border-t border-border bg-muted"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)' }}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('activePackages', { count: selectedPackageIds.length })}</span>
                    <span>{t('documentsCount', { count: uploadedDocs.filter(d => d.status === 'ready').length })}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

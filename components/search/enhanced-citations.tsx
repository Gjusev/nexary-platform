'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText,
  ExternalLink,
  Quote,
  Copy,
  ChevronDown,
  ChevronUp,
  BookOpen,
  MapPin,
  Star,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CitationSource {
  id: string;
  documentId?: string;
  filename: string;
  packageName?: string;
  content: string;
  score: number;
  metadata?: {
    pageNumber?: number;
    pageNumbers?: number[];
    author?: string;
    date?: string;
    fileType?: string;
    chunkIndex?: number;
    totalChunks?: number;
  };
}

export interface EnhancedCitationsProps {
  sources: CitationSource[];
  className?: string;
  showInlineCitations?: boolean;
  onJumpToDocument?: (documentId: string, pageNumber?: number) => void;
}

export function EnhancedCitations({
  sources,
  className,
  showInlineCitations = true,
  onJumpToDocument,
}: EnhancedCitationsProps) {
  const t = useTranslations('citations');
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [showFullPreview, setShowFullPreview] = useState<Set<number>>(new Set());
  const previewRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleCitation = (index: number) => {
    setExpandedCitations((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const togglePreview = (index: number) => {
    setShowFullPreview((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCitationClick = (index: number) => {
    setActiveCitation(activeCitation === index ? null : index);
    toggleCitation(index);
  };

  const handleCopyCitation = async (source: CitationSource, index: number) => {
    const citationText = formatCitationText(source, index + 1);
    await navigator.clipboard.writeText(citationText);
  };

  const formatCitationText = (source: CitationSource, index: number): string => {
    const parts = [`[${index}] ${source.filename}`];
    if (source.metadata?.pageNumber) {
      parts.push(`p. ${source.metadata.pageNumber}`);
    }
    if (source.metadata?.pageNumbers?.length) {
      parts.push(`pp. ${source.metadata.pageNumbers.join(', ')}`);
    }
    if (source.metadata?.author) {
      parts.push(source.metadata.author);
    }
    if (source.metadata?.date) {
      parts.push(source.metadata.date);
    }
    return parts.join(' - ');
  };

  const getScoreColor = (score: number) => {
    const percentage = Math.round(score * 100);
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getScoreBadgeVariant = (score: number) => {
    const percentage = Math.round(score * 100);
    if (percentage >= 80) return 'default';
    if (percentage >= 60) return 'secondary';
    return 'outline';
  };

  if (!sources || sources.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn('w-full', className)}>
        <Card className="border-l-4 border-l-primary/60 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {t('citations') || 'Citations'}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {sources.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setExpandedCitations(new Set())}
              >
                {t('collapseAll') || 'Collapse All'}
              </Button>
            </div>

            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {sources.map((source, index) => {
                  const isExpanded = expandedCitations.has(index);
                  const isFullPreview = showFullPreview.has(index);
                  const hasPageNumbers =
                    source.metadata?.pageNumber ||
                    source.metadata?.pageNumbers?.length;

                  return (
                    <div
                      key={source.id}
                      ref={(el) => { previewRefs.current[index] = el; }}
                      className={cn(
                        'rounded-lg border transition-all duration-200',
                        isExpanded
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold cursor-pointer transition-colors',
                              getScoreColor(source.score),
                              isExpanded ? 'bg-current text-white' : 'bg-current/10'
                            )}
                            onClick={() => handleCitationClick(index)}
                          >
                            {index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span
                                    className="text-sm font-medium truncate hover:text-primary cursor-pointer transition-colors"
                                    title={source.filename}
                                  >
                                    {source.filename}
                                  </span>
                                  {source.packageName && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      {source.packageName}
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <Badge
                                    variant={getScoreBadgeVariant(source.score)}
                                    className={cn('text-xs', getScoreColor(source.score))}
                                  >
                                    <Star className="h-2.5 w-2.5 mr-1" />
                                    {Math.round(source.score * 100)}%
                                  </Badge>

                                  {hasPageNumbers && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-2.5 w-2.5" />
                                      {source.metadata?.pageNumber ? (
                                        <>p. {source.metadata.pageNumber}</>
                                      ) : source.metadata?.pageNumbers ? (
                                        <>pp. {source.metadata.pageNumbers.join(', ')}</>
                                      ) : null}
                                    </span>
                                  )}

                                  {source.metadata?.author && (
                                    <span>{source.metadata.author}</span>
                                  )}

                                  {source.metadata?.fileType && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      {source.metadata.fileType.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleCitationClick(index)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="relative">
                                  <Quote className="absolute top-0 left-0 h-3 w-3 text-primary/30 rotate-180" />
                                  <div className="pl-4 pr-2">
                                    <p
                                      className={cn(
                                        'text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words',
                                        !isFullPreview && 'max-h-[120px] overflow-hidden'
                                      )}
                                    >
                                      {source.content}
                                    </p>
                                    {source.content.length > 200 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-2 h-6 text-xs text-primary hover:text-primary/80 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePreview(index);
                                        }}
                                      >
                                        {isFullPreview ? (
                                          <>
                                            <EyeOff className="h-3 w-3 mr-1" />
                                            {t('showLess') || 'Show Less'}
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="h-3 w-3 mr-1" />
                                            {t('showMore') || 'Show More'}
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                                  {onJumpToDocument && source.documentId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onJumpToDocument(
                                          source.documentId!,
                                          source.metadata?.pageNumber
                                        );
                                      }}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {t('viewDocument') || 'View Document'}
                                    </Button>
                                  )}

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyCitation(source, index);
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                        {t('copyCitation') || 'Copy'}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{formatCitationText(source, index + 1)}</p>
                                    </TooltipContent>
                                  </Tooltip>

                                  {source.metadata?.chunkIndex !== undefined &&
                                    source.metadata?.totalChunks && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {source.metadata.chunkIndex + 1} / {source.metadata.totalChunks}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}

export function InlineCitation({
  index,
  source,
  onClick,
}: {
  index: number;
  source: CitationSource;
  onClick?: () => void;
}) {
  const hasPageNumbers = source.metadata?.pageNumber || source.metadata?.pageNumbers?.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 text-xs rounded transition-all duration-200 hover:scale-105',
            'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40',
            onClick && 'cursor-pointer'
          )}
          onClick={onClick}
          type="button"
        >
          <span className="font-bold">[{index + 1}]</span>
          {hasPageNumbers && (
            <span className="text-[10px] opacity-75">
              {source.metadata?.pageNumber || source.metadata?.pageNumbers?.join(',')}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-sm">{source.filename}</p>
          {hasPageNumbers && (
            <p className="text-xs text-muted-foreground">
              {source.metadata?.pageNumber
                ? `Page ${source.metadata.pageNumber}`
                : `Pages ${source.metadata?.pageNumbers?.join(', ')}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Relevance: {Math.round(source.score * 100)}%
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function CitationText({
  sources,
  onCitationClick,
}: {
  sources: CitationSource[];
  onCitationClick?: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <span className="font-medium">Sources:</span>
      {sources.map((source, index) => (
        <InlineCitation
          key={source.id}
          index={index}
          source={source}
          onClick={() => onCitationClick?.(index)}
        />
      ))}
    </div>
  );
}

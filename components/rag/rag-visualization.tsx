'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { FileText, Network, ExternalLink, Quote, Sparkles, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { RagNetworkGraph } from './rag-network-graph';
import { SourceTooltip } from './source-tooltip';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface RagSource {
    id: string;
    documentId?: string;
    filename: string;
    content: string;
    score: number;
    metadata?: any;
}

interface RagVisualizationProps {
    sources: RagSource[];
    className?: string;
}

export function RagVisualization({ sources, className }: RagVisualizationProps) {
    const t = useTranslations('chat');
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('context');
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

    if (!sources || sources.length === 0) return null;

    const handleJumpToDocument = (documentId?: string) => {
        if (documentId) {
            router.push(`/dashboard/documents?highlight=${documentId}`);
        }
    };

    const toggleSourceExpanded = (idx: number) => {
        setExpandedSources(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const getScoreColor = (score: number) => {
        const percentage = Math.round(score * 100);
        if (percentage >= 80) return 'text-green-600 bg-green-50 dark:bg-green-950/50 dark:text-green-400 border-green-200 dark:border-green-800';
        if (percentage >= 60) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/50 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950/50 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("w-full mt-4", className)}>
            {/* Collapsed Header - "Show me what you found" */}
            <CollapsibleTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-between px-4 py-3 h-auto rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-all"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                            {t('showWhatFound') || 'Show me what you found'}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                            {sources.length} {t('sources') || 'sources'}
                        </Badge>
                    </div>
                    {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2">
                <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                    <Tabs defaultValue="context" value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                    {t('sourcesAnalysis') || 'Analysis & Sources'}
                                </span>
                            </div>
                            <TabsList className="h-8">
                                <TabsTrigger value="context" className="text-xs h-7 px-3">
                                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                                    {t('context') || 'Context'}
                                </TabsTrigger>
                                <TabsTrigger value="network" className="text-xs h-7 px-3">
                                    <Network className="mr-1.5 h-3.5 w-3.5" />
                                    {t('graph') || 'Graph'}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* List / Context View */}
                        <TabsContent value="context" className="p-0 m-0">
                            <ScrollArea className="h-[400px]">
                                <div className="p-4 space-y-4">
                                    {sources.map((source, idx) => (
                                        <SourceTooltip key={idx} source={source}>
                                            <Card className="p-4 border-l-4 border-l-primary/60 transition-all hover:border-l-primary hover:shadow-md cursor-pointer">
                                                {/* Header: Score & Filename */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                        <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                                                            <FileText className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="text-sm font-semibold truncate hover:text-primary transition-colors" title={source.filename}>
                                                                {source.filename}
                                                            </h4>
                                                            <p className="text-xs text-muted-foreground">
                                                                {t('similarity') || 'Relevance'}: {Math.round(source.score * 100)}%
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {/* Score Badge */}
                                                    <Badge variant="outline" className={cn("shrink-0 text-xs font-medium border", getScoreColor(source.score))}>
                                                        {Math.round(source.score * 100)}%
                                                    </Badge>
                                                </div>

                                                {/* Similarity Bar */}
                                                <div className="w-full bg-secondary h-1.5 rounded-full mb-3 overflow-hidden">
                                                    <div
                                                        className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{ width: `${Math.round(source.score * 100)}%` }}
                                                    />
                                                </div>

                                                {/* Extracted Text Snippet - Scrollable */}
                                                <div className="relative rounded-lg bg-muted/50 p-3 overflow-x-hidden">
                                                    <Quote className="absolute top-2 left-2 h-3 w-3 text-primary/40 rotate-180" />
                                                    <div className={cn(
                                                        "pl-5 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-all overflow-wrap-anywhere",
                                                        expandedSources.has(idx) ? "" : "max-h-[120px] overflow-hidden"
                                                    )}>
                                                        {source.content}
                                                    </div>
                                                    {source.content.length > 200 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="mt-2 h-6 text-xs text-primary hover:text-primary/80 p-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSourceExpanded(idx);
                                                            }}
                                                        >
                                                            {expandedSources.has(idx)
                                                                ? (t('showLess') || 'Show less')
                                                                : (t('showMore') || 'Show more')
                                                            }
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="mt-3 flex items-center gap-2">
                                                    {source.documentId && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1.5"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleJumpToDocument(source.documentId);
                                                            }}
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            {t('jumpToDocument') || 'View Document'}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(source.content);
                                                        }}
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                        {t('copyContext') || 'Copy'}
                                                    </Button>
                                                </div>
                                            </Card>
                                        </SourceTooltip>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* Network Graph View */}
                        <TabsContent value="network" className="p-0 m-0 border-t border-border">
                            <div className="w-full h-[405px] bg-background">
                                <RagNetworkGraph sources={sources} />
                            </div>
                        </TabsContent>

                    </Tabs>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

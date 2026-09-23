'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink, Quote, Sparkles } from 'lucide-react';
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

interface SourceTooltipProps {
    source: RagSource;
    children: React.ReactNode;
    className?: string;
}

export function SourceTooltip({ source, children, className }: SourceTooltipProps) {
    const t = useTranslations('chat');
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const handleJumpToDocument = () => {
        if (source.documentId) {
            router.push(`/dashboard/documents?highlight=${source.documentId}`);
        }
        setOpen(false);
    };

    const scorePercentage = Math.round(source.score * 100);
    const scoreColor = scorePercentage >= 80
        ? 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400'
        : scorePercentage >= 60
            ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400'
            : 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400';

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip open={open} onOpenChange={setOpen}>
                <TooltipTrigger asChild>
                    <span className={cn("cursor-pointer", className)}>
                        {children}
                    </span>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                    className="w-[400px] p-0 bg-popover border-border shadow-xl"
                    sideOffset={8}
                >
                    <div className="p-4 space-y-3">
                        {/* Header with filename and score */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-semibold truncate" title={source.filename}>
                                        {source.filename}
                                    </h4>
                                </div>
                            </div>
                            <Badge
                                variant="secondary"
                                className={cn("shrink-0 text-xs font-medium", scoreColor)}
                            >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {scorePercentage}%
                            </Badge>
                        </div>

                        {/* Relevance bar */}
                        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${scorePercentage}%` }}
                            />
                        </div>

                        {/* Content excerpt */}
                        <div className="relative rounded-lg bg-muted/50 p-3">
                            <Quote className="absolute top-2 left-2 h-3 w-3 text-primary/40 rotate-180" />
                            <ScrollArea className="max-h-[150px]">
                                <div className="pl-5 text-xs text-muted-foreground font-mono leading-relaxed">
                                    {source.content.length > 500
                                        ? `${source.content.substring(0, 500)}...`
                                        : source.content
                                    }
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Action button */}
                        {source.documentId && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs gap-2"
                                onClick={handleJumpToDocument}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {t('jumpToDocument') || 'View in Document Hub'}
                            </Button>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

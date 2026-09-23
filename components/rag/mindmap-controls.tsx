"use client";

import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface MindMapControlsProps {
    similarityThreshold: number;
    onSimilarityChange: (value: number) => void;
    viewMode: 'chunks' | 'documents';
    onViewModeChange: (mode: 'chunks' | 'documents') => void;
    layoutAlgorithm?: 'force' | 'hierarchical' | 'circular';
    onLayoutChange?: (layout: 'force' | 'hierarchical' | 'circular') => void;
}

export default function MindMapControls({
    similarityThreshold,
    onSimilarityChange,
    viewMode,
    onViewModeChange,
    layoutAlgorithm = 'force',
    onLayoutChange,
}: MindMapControlsProps) {
    const t = useTranslations('dashboard.rag.mindmap');

    return (
        <Card className="p-4 space-y-4 bg-background/95 backdrop-blur-sm">
            {/* Similarity Threshold */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="similarity-threshold" className="text-sm font-medium">
                        {t('similarityThreshold')}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                        {(similarityThreshold * 100).toFixed(0)}%
                    </span>
                </div>
                <Slider
                    id="similarity-threshold"
                    min={0}
                    max={100}
                    step={5}
                    value={[similarityThreshold * 100]}
                    onValueChange={(values) => onSimilarityChange(values[0] / 100)}
                    className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                    Higher values show only highly similar connections
                </p>
            </div>

            {/* View Mode */}
            <div className="space-y-2">
                <Label htmlFor="view-mode" className="text-sm font-medium">
                    View Mode
                </Label>
                <Select value={viewMode} onValueChange={onViewModeChange}>
                    <SelectTrigger id="view-mode">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="chunks">Chunks</SelectItem>
                        <SelectItem value="documents">Documents</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    {viewMode === 'chunks'
                        ? 'Show individual text chunks with detailed connections'
                        : 'Show documents with high-level connections'}
                </p>
            </div>

            {/* Layout Algorithm (optional) */}
            {onLayoutChange && (
                <div className="space-y-2">
                    <Label htmlFor="layout-algorithm" className="text-sm font-medium">
                        {t('layoutAlgorithm')}
                    </Label>
                    <Select value={layoutAlgorithm} onValueChange={onLayoutChange}>
                        <SelectTrigger id="layout-algorithm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="force">Force-Directed</SelectItem>
                            <SelectItem value="hierarchical">Hierarchical</SelectItem>
                            <SelectItem value="circular">Circular</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </Card>
    );
}

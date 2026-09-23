'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Download, Heart, Loader2 } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface TemplatePreviewModalProps {
    templateId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUse: () => void;
}

export function TemplatePreviewModal({
    templateId,
    open,
    onOpenChange,
    onUse,
}: TemplatePreviewModalProps) {
    const { toast } = useToast();
    const [template, setTemplate] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && templateId) {
            fetchTemplate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, templateId]);

    const fetchTemplate = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/templates/${templateId}`);
            if (response.ok) {
                const data = await response.json();
                setTemplate(data);
            }
        } catch (error) {
            console.error('[Template Preview] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!template) return;

        const dataStr = JSON.stringify(template, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        link.click();
        URL.revokeObjectURL(url);

        toast({
            title: 'Template exportado',
            description: 'El archivo JSON se ha descargado',
        });
    };

    if (!template && loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!template) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{template.name}</DialogTitle>
                    <DialogDescription className="text-base">
                        {template.description}
                    </DialogDescription>
                    <div className="flex gap-2 pt-2">
                        <Badge>{template.category}</Badge>
                        {template.is_featured && <Badge variant="secondary">Featured</Badge>}
                        <Badge variant="outline">{template.usage_count} usos</Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* System Prompt */}
                    <div>
                        <h3 className="font-semibold mb-2">System Prompt</h3>
                        <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                            {template.system_prompt}
                        </div>
                    </div>

                    <Separator />

                    {/* Sample Prompts */}
                    {template.sample_prompts && template.sample_prompts.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">Preguntas de Ejemplo</h3>
                            <ul className="space-y-2">
                                {template.sample_prompts.map((prompt: string, idx: number) => (
                                    <li
                                        key={idx}
                                        className="flex items-start gap-2 text-sm p-2 rounded hover:bg-muted/50"
                                    >
                                        <span className="text-muted-foreground mt-0.5">•</span>
                                        <span>{prompt}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <Separator />

                    {/* Tags */}
                    {template.tags && template.tags.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {template.tags.map((tag: string, idx: number) => (
                                    <Badge key={idx} variant="outline">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                    <Button onClick={onUse} className="flex-1">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Usar Template
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

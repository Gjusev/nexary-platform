'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ExternalLink, TrendingUp, Sparkles } from 'lucide-react';
import * as Icons from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TemplatePreviewModal } from './template-preview-modal';

interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    usage_count: number;
    is_featured: boolean;
    is_favorited?: boolean;
}

interface TemplateCardProps {
    template: Template;
    onUpdate: () => void;
}

const categoryColors: Record<string, string> = {
    legal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    finance: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    hr: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    sales: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    tech: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    support: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
    research: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
    marketing: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    data: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
    project: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export function TemplateCard({ template, onUpdate }: TemplateCardProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isFavorited, setIsFavorited] = useState(template.is_favorited || false);
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(false);

    const IconComponent = (Icons as any)[template.icon] || Sparkles;

    const handleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoading(true);

        try {
            const response = await fetch('/api/templates/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: template.id,
                    action: isFavorited ? 'remove' : 'add',
                }),
            });

            if (response.ok) {
                setIsFavorited(!isFavorited);
                toast({
                    title: isFavorited ? 'Removido de favoritos' : 'Añadido a favoritos',
                    duration: 2000,
                });
                onUpdate();
            }
        } catch (error) {
            console.error('[TemplateCard] Error toggling favorite:', error);
            toast({
                title: 'Error',
                description: 'No se pudo actualizar favoritos',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUse = async () => {
        // Record usage
        await fetch(`/api/templates/${template.id}/use`, { method: 'POST' });

        // Redirect to chat with template
        router.push(`/chat?template=${template.id}`);
    };

    return (
        <>
            <Card className="hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full -z-10 group-hover:scale-150 transition-transform" />

                <CardHeader onClick={() => setShowPreview(true)}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                                <IconComponent className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <CardTitle className="text-lg">{template.name}</CardTitle>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleFavorite}
                            disabled={loading}
                            className="shrink-0"
                        >
                            <Heart
                                className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`}
                            />
                        </Button>
                    </div>
                    <CardDescription className="mt-2 line-clamp-2">
                        {template.description}
                    </CardDescription>
                </CardHeader>

                <CardContent onClick={() => setShowPreview(true)}>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={categoryColors[template.category] || 'bg-gray-100'}>
                            {template.category}
                        </Badge>
                        {template.is_featured && (
                            <Badge variant="secondary" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                Featured
                            </Badge>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                            <TrendingUp className=" h-3 w-3" />
                            {template.usage_count}
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                        className="flex-1"
                    >
                        Vista previa
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleUse}
                        className="flex-1"
                    >
                        Usar <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>

            <TemplatePreviewModal
                templateId={template.id}
                open={showPreview}
                onOpenChange={setShowPreview}
                onUse={handleUse}
            />
        </>
    );
}

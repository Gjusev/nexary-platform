'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import DOMPurify from 'dompurify';

// Sanitize SVG output from mermaid - allow only safe SVG elements
const sanitizeSvg = (svg: string): string => {
  return DOMPurify.sanitize(svg, {
    ALLOWED_TAGS: ['svg', 'g', 'path', 'text', 'line', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'tspan', 'defs', 'use', 'style', 'marker', 'pattern', 'linearGradient', 'radialGradient', 'stop', 'foreignObject'],
    ALLOWED_ATTR: ['d', 'fill', 'stroke', 'transform', 'style', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'viewBox', 'xmlns', 'version', 'class', 'id', 'text-anchor', 'font-size', 'font-family', 'font-weight', 'opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'marker-end', 'marker-start', 'marker-mid', 'offset', 'stop-color', 'stop-opacity', 'gradientTransform', 'gradientUnits', 'spreadMethod', 'patternUnits', 'patternTransform', 'points', 'role'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'object', 'iframe', 'form', 'input', 'button', 'a', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'xlink:href', 'href'],
  });
};

interface MermaidDiagramProps {
    code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { resolvedTheme } = useTheme();
    const t = useTranslations('chat.mermaid');

    useEffect(() => {
        let isMounted = true;

        const renderDiagram = async () => {
            try {
                setLoading(true);
                setError(null);

                // Dynamically import mermaid to avoid SSR issues
                const mermaid = (await import('mermaid')).default;

                mermaid.initialize({
                    startOnLoad: false,
                    theme: resolvedTheme === 'dark' ? 'dark' : 'default',
                    securityLevel: 'loose',
                    fontFamily: 'inherit',
                });

                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const { svg: renderedSvg } = await mermaid.render(id, code);

                if (isMounted) {
                    setSvg(renderedSvg);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Mermaid rendering error:', err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : t('errorRendering'));
                    setLoading(false);
                }
            }
        };

        renderDiagram();

        return () => {
            isMounted = false;
        };
    }, [code, resolvedTheme, t]);

    const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
    const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
    const handleResetZoom = () => setScale(1);

    const handleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    if (loading) {
        return (
            <div className="my-4 flex items-center justify-center rounded-lg border border-border bg-muted/30 p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">{t('loading')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="my-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">{t('errorRendering')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                    <code>{code}</code>
                </pre>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`group my-4 rounded-lg border border-border bg-card overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 m-0 rounded-none' : ''
                }`}
        >
            {/* Controls */}
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Mermaid
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleZoomOut}
                        title={t('zoomOut')}
                    >
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleResetZoom}
                        title={t('resetZoom')}
                    >
                        {Math.round(scale * 100)}%
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleZoomIn}
                        title={t('zoomIn')}
                    >
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleFullscreen}
                        title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Diagram content */}
            <div
                className={`overflow-auto p-4 ${isFullscreen ? 'h-[calc(100%-40px)]' : 'max-h-[500px]'}`}
            >
                <div
                    className="flex items-center justify-center min-h-[200px] transition-transform"
                    style={{ transform: `scale(${scale})`, transformOrigin: 'center top' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
                />
            </div>
        </div>
    );
}

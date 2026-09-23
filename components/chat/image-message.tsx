'use client';

/**
 * Image Message Component
 *
 * Displays images in chat messages with:
 * - Thumbnail preview
 * - Full-size modal view
 * - File info display
 * - Multiple images support
 */

import { useState } from 'react';
import { X, ZoomIn, Download, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface MessageImage {
  /** Base64 data URL */
  dataUrl: string;
  /** Original file name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** Width in pixels (optional) */
  width?: number;
  /** Height in pixels (optional) */
  height?: number;
}

interface ImageMessageProps {
  /** Images to display */
  images: MessageImage[];
  /** Maximum thumbnails to show before "show more" */
  maxThumbnails?: number;
  /** Thumbnail size in pixels (default: 200) */
  thumbnailSize?: number;
  /** Whether to show file info */
  showFileInfo?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Image message component for displaying images in chat.
 *
 * @example
 * ```tsx
 * <ImageMessage
 *   images={[
 *     { dataUrl: 'data:image/jpeg;base64,...', name: 'photo.jpg', size: 1024000, type: 'image/jpeg' }
 *   ]}
 *   maxThumbnails={3}
 *   thumbnailSize={200}
 * />
 * ```
 */
export function ImageMessage({
  images,
  maxThumbnails = 3,
  thumbnailSize = 200,
  showFileInfo = true,
  className,
}: ImageMessageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const visibleImages = images.slice(0, maxThumbnails);
  const remainingCount = images.length - maxThumbnails;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Image thumbnails grid */}
      <div className="flex flex-wrap gap-2">
        {visibleImages.map((image, idx) => (
          <Dialog key={idx}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="relative group rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
                style={{
                  width: `${thumbnailSize}px`,
                  height: `${thumbnailSize}px`,
                }}
                onClick={() => setSelectedIndex(idx)}
              >
                {/* Image thumbnail - using img for base64 data URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  className="w-full h-full object-cover"
                />

                {/* Overlay with zoom icon */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>

                {/* File info badge */}
                {showFileInfo && (
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground truncate">
                    {image.name}
                  </div>
                )}
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none">
              <div className="relative">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => (document.querySelector('[data-radix-collection]') as HTMLButtonElement)?.click()}
                  className="absolute -top-10 right-0 p-2 rounded-full bg-background hover:bg-muted border border-border"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Full size image - using img for base64 data URLs */}
                <div className="flex items-center justify-center bg-background/95 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.dataUrl}
                    alt={image.name}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                </div>

                {/* Image info bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileImage className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-md">
                          {image.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {image.type} • {formatFileSize(image.size)}
                          {image.width && image.height && (
                            <span> • {image.width} × {image.height}px</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Download button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = image.dataUrl;
                        link.download = image.name;
                        link.click();
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}

        {/* Show more indicator */}
        {remainingCount > 0 && (
          <button
            type="button"
            className="relative rounded-lg overflow-hidden border border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center bg-muted/30"
            style={{
              width: `${thumbnailSize}px`,
              height: `${thumbnailSize}px`,
            }}
          >
            <div className="text-center">
              <span className="text-2xl font-semibold text-muted-foreground">+{remainingCount}</span>
              <p className="text-xs text-muted-foreground mt-1">
                more image{remainingCount > 1 ? 's' : ''}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Image count info */}
      {images.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {images.length} image{images.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

'use client';

/**
 * Image Upload Component
 *
 * Handles image upload with:
 * - Drag and drop support
 * - File picker
 * - Image preview
 * - Base64 conversion
 * - File size validation
 * - Multiple images support
 */

import { useState, useRef, type ChangeEvent } from 'react';
import { X, Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ImageFile {
  /** Base64 data URL */
  dataUrl: string;
  /** Original file name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
}

interface ImageUploadProps {
  /** Currently selected images */
  images: ImageFile[];
  /** Callback when images are added */
  onImagesAdd: (images: ImageFile[]) => void;
  /** Callback when an image is removed */
  onImageRemove: (index: number) => void;
  /** Maximum number of images allowed (default: 4) */
  maxImages?: number;
  /** Maximum file size in MB (default: 10) */
  maxSizeMB?: number;
  /** Accepted MIME types */
  accept?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Image upload component with drag-and-drop support.
 *
 * @example
 * ```tsx
 * <ImageUpload
 *   images={selectedImages}
 *   onImagesAdd={(images) => setSelectedImages([...selectedImages, ...images])}
 *   onImageRemove={(index) => setSelectedImages(selectedImages.filter((_, i) => i !== index))}
 *   maxImages={4}
 *   maxSizeMB={10}
 * />
 * ```
 */
export function ImageUpload({
  images,
  onImagesAdd,
  onImageRemove,
  maxImages = 4,
  maxSizeMB = 10,
  accept = 'image/png,image/jpeg,image/jpg,image/webp,image/gif',
  disabled = false,
  className,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  /**
   * Convert a file to base64 and get image dimensions
   */
  const processFile = (file: File): Promise<ImageFile> => {
    return new Promise((resolve, reject) => {
      // Validate file size
      if (file.size > maxSizeBytes) {
        reject(new Error(`File too large (max ${maxSizeMB}MB)`));
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Invalid file type. Please upload an image.'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl,
            name: file.name,
            size: file.size,
            type: file.type,
            width: img.width,
            height: img.height,
          });
        };
        img.onerror = () => {
          // If we can't load the image, still resolve with basic info
          resolve({
            dataUrl,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        };
        img.src = dataUrl;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  };

  /**
   * Handle file selection from input
   */
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    // Reset input so same files can be selected again
    e.target.value = '';
  };

  /**
   * Handle drop events
   */
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  /**
   * Process files and add valid images
   */
  const processFiles = async (files: File[]) => {
    setError(null);

    if (files.length === 0) return;

    // Check max images limit
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const processedImages: ImageFile[] = [];
    const errors: string[] = [];

    for (const file of filesToProcess) {
      try {
        const imageFile = await processFile(file);
        processedImages.push(imageFile);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process image';
        errors.push(`${file.name}: ${message}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
    }

    if (processedImages.length > 0) {
      onImagesAdd(processedImages);
    }
  };

  /**
   * Trigger file input click
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden border border-border bg-muted/30"
              style={{ maxWidth: '100px' }}
            >
              {/* Image thumbnail - using img for base64 data URLs */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.dataUrl}
                alt={image.name}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '100px' }}
              />

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onImageRemove(index)}
                className={cn(
                  'absolute top-1 right-1 p-1 rounded-full bg-background/90',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'hover:bg-background shadow-sm border border-border',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={disabled}
                title="Remove image"
              >
                <X className="h-3 w-3" />
              </button>

              {/* File info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-background/90 px-1 py-0.5 text-[10px] text-muted-foreground truncate">
                {formatFileSize(image.size)}
              </div>
            </div>
          ))}

          {/* Add more button if below limit */}
          {images.length < maxImages && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClick}
              className="h-auto rounded-lg"
              style={{ width: '100px', minHeight: '100px' }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Upload area (shown when no images or can add more) */}
      {images.length < maxImages && (
        <div
          onClick={disabled ? undefined : handleClick}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={disabled ? undefined : handleDrop}
          className={cn(
            'relative rounded-lg border-2 border-dashed transition-colors cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex flex-col items-center justify-center px-4 py-6 text-center">
            <div
              className={cn(
                'mb-2 rounded-full p-2',
                isDragging
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isDragging ? (
                <Upload className="h-5 w-5" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {isDragging ? 'Drop images here' : 'Add images'}
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP up to {maxSizeMB}MB
            </p>
            {images.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {images.length}/{maxImages} images
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// Helper component for the add button icon
function Plus({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

'use client';

/**
 * Loading Boundary Component
 *
 * Provides a reusable loading state with skeleton screens
 * for use with React Suspense and lazy-loaded components.
 *
 * @example
 * ```tsx
 * <Suspense fallback={<LoadingBoundary type="skeleton" />}>
 *   <LazyComponent />
 * </Suspense>
 * ```
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LoadingBoundaryType =
  | 'spinner'
  | 'skeleton'
  | 'dots'
  | 'bar'
  | 'chat'
  | 'table'
  | 'card'
  | 'document';

export interface LoadingBoundaryProps {
  type?: LoadingBoundaryType;
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

/**
 * Basic spinner loading
 */
function SpinnerLoader({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
    </div>
  );
}

/**
 * Skeleton screen loader
 */
function SkeletonLoader({ type = 'card' }: { type?: LoadingBoundaryType }) {
  const renderSkeleton = () => {
    switch (type) {
      case 'chat':
        return (
          <div className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-start gap-3 justify-end">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse ml-auto" />
              </div>
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="space-y-3 p-4">
            <div className="flex gap-4">
              <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-8 flex-1 bg-muted/50 rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-muted/50 rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-muted/50 rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-muted/50 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="space-y-4 p-6">
            <div className="h-8 w-1/3 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
            </div>
            <div className="pt-4 space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            </div>
          </div>
        );

      case 'card':
      default:
        return (
          <div className="space-y-4 p-6">
            <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex gap-2 pt-4">
              <div className="h-9 w-24 bg-muted rounded animate-pulse" />
              <div className="h-9 w-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      {renderSkeleton()}
    </div>
  );
}

/**
 * Dots animation loader
 */
function DotsLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dotSize = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  }[size];

  return (
    <div className="flex items-center justify-center gap-2">
      <div className={cn('bg-primary rounded-full animate-bounce', dotSize)} style={{ animationDelay: '0ms' }} />
      <div className={cn('bg-primary rounded-full animate-bounce', dotSize)} style={{ animationDelay: '150ms' }} />
      <div className={cn('bg-primary rounded-full animate-bounce', dotSize)} style={{ animationDelay: '300ms' }} />
    </div>
  );
}

/**
 * Progress bar loader
 */
function BarLoader({ className }: { className?: string }) {
  return (
    <div className={cn('w-full overflow-hidden', className)}>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary animate-progress w-1/3 origin-left" />
      </div>
    </div>
  );
}

/**
 * Main Loading Boundary Component
 */
export function LoadingBoundary({
  type = 'spinner',
  message,
  className,
  size = 'md',
  fullScreen = false,
}: LoadingBoundaryProps) {
  const content = (() => {
    switch (type) {
      case 'skeleton':
      case 'chat':
      case 'table':
      case 'document':
        return <SkeletonLoader type={type} />;

      case 'dots':
        return (
          <div className={cn('flex flex-col items-center gap-2', className)}>
            <DotsLoader size={size} />
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        );

      case 'bar':
        return <BarLoader className={className} />;

      case 'spinner':
      default:
        return (
          <div className={cn('flex flex-col items-center gap-3', className)}>
            <SpinnerLoader size={size} />
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        );
    }
  })();

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return <>{content}</>;
}

/**
 * Preset loading boundaries for common use cases
 */
export const loadingPresets = {
  /**
   * Loading state for chat interface
   */
  chat: (props?: Omit<LoadingBoundaryProps, 'type'>) => (
    <LoadingBoundary type="chat" {...props} />
  ),

  /**
   * Loading state for data tables
   */
  table: (props?: Omit<LoadingBoundaryProps, 'type'>) => (
    <LoadingBoundary type="table" {...props} />
  ),

  /**
   * Loading state for document viewer
   */
  document: (props?: Omit<LoadingBoundaryProps, 'type'>) => (
    <LoadingBoundary type="document" {...props} />
  ),

  /**
   * Loading state for cards
   */
  card: (props?: Omit<LoadingBoundaryProps, 'type'>) => (
    <LoadingBoundary type="skeleton" {...props} />
  ),

  /**
   * Minimal inline loading
   */
  inline: (props?: Omit<LoadingBoundaryProps, 'type' | 'fullScreen'>) => (
    <LoadingBoundary type="dots" size="sm" {...props} />
  ),

  /**
   * Full-screen loading
   */
  fullScreen: (props?: Omit<LoadingBoundaryProps, 'fullScreen' | 'type'>) => (
    <LoadingBoundary type="spinner" fullScreen {...props} />
  ),
} as const;

/**
 * HOC to wrap components with loading state
 *
 * @example
 * ```tsx
 * const HeavyComponent = withLoadingBoundary(
 *   lazy(() => import('./HeavyComponent')),
 *   { type: 'skeleton' }
 * );
 * ```
 */
export function withLoadingBoundary<P extends object>(
  Component: React.ComponentType<P>,
  loadingProps?: LoadingBoundaryProps
) {
  return function WrappedWithLoading(props: P) {
    return (
      <React.Suspense fallback={<LoadingBoundary {...loadingProps} />}>
        <Component {...props} />
      </React.Suspense>
    );
  };
}

// Add custom animation for progress bar
const style = document.createElement('style');
style.textContent = `
  @keyframes progress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  .animate-progress {
    animation: progress 1.5s ease-in-out infinite;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

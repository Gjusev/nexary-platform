/**
 * Dynamic import utilities for heavy components
 * Use these to lazy load components and reduce initial bundle size
 */

'use client';

import dynamic from 'next/dynamic';
import { ComponentType, type ReactNode } from 'react';

// Default loading component - a simple spinner
const DefaultLoading = () => (
  <div className="flex items-center justify-center p-4">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

/**
 * Higher-order function to create dynamic imports with consistent loading behavior
 */
export function createDynamicImport<T = object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options?: {
    loading?: ComponentType;
    ssr?: boolean;
  }
) {
  const LoadingComponent = options?.loading;
  const loadingFn = LoadingComponent
    ? function createDynamicImportLoading(props: any) {
        return <LoadingComponent {...props} />;
      }
    : function createDefaultLoading(props: any) {
        return <DefaultLoading {...props} />;
      };

  // eslint-disable-next-line react/display-name
  return dynamic(importFn, {
    loading: loadingFn,
    ssr: options?.ssr ?? true,
  });
}

// Heavy visualization components - load only when needed
export const ReactFlow = dynamic(() => import('reactflow'), {
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading flow chart...</div>
    </div>
  ),
  ssr: false,
});

export const loadRecharts = async () => {
  const Recharts = await import('recharts');
  return Recharts;
};

export const MermaidDiagram = dynamic(
  () => import('@/components/mermaid-diagram').then(mod => ({ default: mod.MermaidDiagram })),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading diagram...</div>
      </div>
    ),
    ssr: false,
  });

// Particle effects - very heavy, load only when needed
export const TsParticles = dynamic(() => import('@tsparticles/react'), {
  loading: () => (
    <div className="flex h-32 items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading particles...</div>
    </div>
  ),
  ssr: false,
});

// Syntax highlighting - load only when displaying code
export const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter'),
  {
    loading: () => (
      <div className="h-32 animate-pulse bg-muted" />
    ),
    ssr: false,
  }
);

// Markdown renderer - load only when rendering markdown
export const ReactMarkdown = dynamic(() => import('react-markdown'), {
  loading: () => (
    <div className="space-y-3">
      <div className="h-4 animate-pulse bg-muted" />
      <div className="h-4 w-3/4 animate-pulse bg-muted" />
      <div className="h-4 w-1/2 animate-pulse bg-muted" />
    </div>
  ),
  ssr: false,
});

// Date picker - load only when needed
export const DatePicker = dynamic(
  () => import('react-day-picker').then(mod => ({ default: mod.DayPicker })),
  {
    loading: () => (
      <div className="h-80 w-80 animate-pulse rounded-lg bg-muted" />
    ),
    ssr: false,
  }
);

// Data visualization components
export const DataChart = dynamic(
  () => import('@/components/data/data-chart').then(mod => ({ default: mod.DataChart })),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading chart...</div>
      </div>
    ),
    ssr: false,
  });

export const ExcelViewer = dynamic(
  () => import('@/components/data/excel-viewer').then(mod => ({ default: mod.ExcelViewer })),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading spreadsheet...</div>
      </div>
    ),
    ssr: false,
  });

// RAG visualization components - very heavy
export const RagVisualization = dynamic(
  () => import('@/components/rag/rag-visualization').then(mod => ({ default: mod.RagVisualization })),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading visualization...</div>
      </div>
    ),
    ssr: false,
  }
);

export const RagNetworkGraph = dynamic(
  () => import('@/components/rag/rag-network-graph').then(mod => ({ default: mod.RagNetworkGraph })),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading network graph...</div>
      </div>
    ),
    ssr: false,
  }
);

export const MindmapViewer = dynamic(
  () => import('@/components/rag/mindmap-viewer'),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading mind map...</div>
      </div>
    ),
    ssr: false,
  }
);

// Admin/analytics components - load only in admin routes
export const AnalyticsChart = dynamic(
  () => import('@/components/ui/chart').then(mod => ({ default: mod.ChartContainer })),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading analytics...</div>
      </div>
    ),
    ssr: false,
  }
);

// Report viewer - load only when viewing reports
export const ReportViewer = dynamic(
  () => import('@/components/chat/report-viewer-dialog').then(mod => ({ default: mod.ReportViewerDialog })),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading report...</div>
      </div>
    ),
    ssr: false,
  }
);

// Confetti - load only for celebrations
export const Confetti = dynamic(
  () => import('canvas-confetti').then(mod => ({ default: mod.default })),
  {
    ssr: false,
  }
);

// QR code generation - load only when needed
// Note: qrcode is a utility library, not a React component, so we use a lazy loader instead of dynamic()
export const loadQRCode = async () => {
  const QRCode = await import('qrcode');
  return QRCode;
};

/**
 * Helper for route-based code splitting
 * Use this in page.tsx files to lazy load route-specific heavy components
 */
export function lazyPage<T = object>(
  importFn: () => Promise<{ default: ComponentType<T> }>
) {
  return dynamic(importFn, {
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    ),
    ssr: true,
  });
}

/**
 * Preload a component dynamically
 * Call this when you want to start loading a component before it's needed
 */
export function preloadComponent(importFn: () => Promise<any>) {
  // Start loading the component in the background
  importFn().catch(() => {
    // Ignore errors during preloading
  });
}

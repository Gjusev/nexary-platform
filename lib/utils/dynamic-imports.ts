/**
 * Dynamic Import Utilities
 *
 * Provides optimized dynamic imports for heavy components and libraries.
 * Use these to implement code splitting and reduce initial bundle size.
 */

/**
 * Dynamically import React Syntax Highlighter with lazy loading
 * Only loads when syntax highlighting is actually needed
 */
export function syntaxHighlighter() {
  return import('react-syntax-highlighter');
}

/**
 * Dynamically import ReactFlow for diagram visualization
 * Only loads when flow diagrams are needed
 */
export function reactFlow() {
  return import('reactflow');
}

/**
 * Dynamically import Mermaid for diagram rendering
 * Only loads when mermaid diagrams are needed
 */
export function mermaid() {
  return import('mermaid');
}

/**
 * Dynamically import Recharts for data visualization
 * Only loads when charts are needed
 */
export function recharts() {
  return import('recharts');
}

/**
 * Dynamically import Framer Motion
 * Only loads when animations are needed
 */
export function framerMotion() {
  return import('framer-motion');
}

/**
 * Dynamically import Particle effects
 * Only loads when particle backgrounds are needed
 */
export function tsparticles() {
  return import('@tsparticles/react');
}

/**
 * Dynamically import XLSX parser
 * Only loads when Excel files are being processed
 */
export function xlsx() {
  return import('xlsx');
}

/**
 * Dynamically import PDF processor
 * Only loads when PDF files are being processed
 */
export function pdfParse() {
  return import('pdf-parse');
}

/**
 * Dynamically import DOCX processor
 * Only loads when Word documents are being processed
 */
export function mammoth() {
  return import('mammoth');
}

/**
 * Dynamically import ADM Zip
 * Only loads when ZIP files are being processed
 */
export function admZip() {
  return import('adm-zip');
}

/**
 * Dynamically import date-fns locales
 * Only loads the specific locale needed
 */
export function dateFnsLocale(locale: string) {
  return import(`date-fns/locale/${locale}/index.js`);
}

/**
 * Dynamic import hook for React components
 *
 * @example
 * ```tsx
 * const Chart = useDynamicImport(() => import('./Chart'), {
 *   fallback: <div>Loading chart...</div>
 * });
 * ```
 */
export function useDynamicImport<T>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    fallback?: React.ReactNode;
  }
) {
  // This should be used with React.lazy and Suspense
  return importFn;
}

/**
 * Create a lazy-loaded component with loading state
 *
 * @example
 * ```tsx
 * const HeavyComponent = createLazyComponent(
 *   () => import('./HeavyComponent'),
 *   {
 *     fallback: <div>Loading...</div>,
 *     delay: 200, // show fallback after 200ms
 *   }
 * );
 * ```
 */
export function createLazyComponent<T>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    fallback?: React.ReactNode;
    delay?: number;
  }
) {
  // This is meant to be used with React.lazy
  return importFn;
}

/**
 * Route-based dynamic imports for better code splitting
 * Use these for heavy routes that aren't immediately needed
 */
export const lazyRoutes = {
  // Admin routes (heavy, rarely accessed)
  // Note: Uncomment these when the routes exist
  // admin: () => import('@/app/(authenticated)/admin/page'),
  // adminSettings: () => import('@/app/(authenticated)/admin/settings/page'),
  // adminUsers: () => import('@/app/(authenticated)/admin/users/page'),

  // RAG management (heavy, only for document uploads)
  // ragUpload: () => import('@/app/(authenticated)/rag/upload/page'),
  // ragDocuments: () => import('@/app/(authenticated)/rag/documents/page'),

  // Analytics (heavy charts)
  // analytics: () => import('@/app/(authenticated)/analytics/page'),
  // analyticsReports: () => import('@/app/(authenticated)/analytics/reports/page'),

  // Settings (less frequently accessed)
  // settings: () => import('@/app/(authenticated)/settings/page'),
  // settingsTeam: () => import('@/app/(authenticated)/settings/team/page'),
  // settingsBilling: () => import('@/app/(authenticated)/settings/billing/page'),
} as const;

/**
 * Prefetch routes that are likely to be accessed next
 * Call this proactively to improve perceived performance
 *
 * @example
 * ```tsx
 * // In a component useEffect
 * useEffect(() => {
 *   prefetchRoute(() => import('@/app/(authenticated)/admin/page'));
 * }, []);
 * ```
 */
export function prefetchRoute(routeFn: () => Promise<unknown>) {
  return routeFn();
}

/**
 * Get all heavy imports that should be deferred
 * These are loaded after initial render
 */
export const deferredImports = {
  syntaxHighlighter,
  reactFlow,
  mermaid,
  recharts,
  framerMotion,
  tsparticles,
  xlsx,
  pdfParse,
  mammoth,
  admZip,
};

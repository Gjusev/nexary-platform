# Performance Optimization Guide

This document outlines the performance optimizations implemented in the Nexary application and best practices for maintaining optimal bundle size and runtime performance.

## Bundle Size Target

**Goal**: Keep total bundle size under 500KB gzipped for optimal initial load time.

## Implemented Optimizations

### 1. Aggressive Code Splitting (`next.config.js`)

The webpack configuration includes aggressive code splitting with separate chunks for:

- **React & React-DOM** - Core framework (priority 20)
- **UI Libraries** - Radix UI, Lucide icons, Sonner (priority 15)
- **Visualization** - Recharts, ReactFlow, Mermaid, Particles (priority 12)
- **Animation** - Framer Motion, Lenis (priority 12)
- **Markdown** - React Markdown, Syntax Highlighter (priority 12)
- **Stack Auth** - Authentication library (priority 12)
- **Date Utils** - date-fns, React Day Picker (priority 11)
- **Supabase** - Database client (priority 11)

### 2. Package Import Optimization

The `experimental.optimizePackageImports` configuration optimizes imports for:
- All Radix UI components
- Lucide React icons
- Utility libraries (clsx, tailwind-merge, cva)

### 3. Dynamic Import Utilities (`lib/dynamic-imports.ts`)

Created pre-configured dynamic imports for heavy components:

```typescript
// Instead of:
import { DataChart } from '@/components/data/data-chart';

// Use:
import { DataChart } from '@/lib/dynamic-imports';
```

Available dynamic imports:
- `ReactFlow`, `Recharts`, `MermaidDiagram`
- `FramerMotion`, `TsParticles`
- `SyntaxHighlighter`, `ReactMarkdown`
- `DatePicker`, `QRCode`, `Confetti`
- `DataChart`, `ExcelViewer`
- `RagVisualization`, `RagNetworkGraph`, `MindmapViewer`
- `AnalyticsChart`, `ReportViewer`

### 4. Image Optimization

- Enabled modern image formats (AVIF, WebP)
- Configured cache headers for static assets
- Minimum cache TTL of 60 seconds for remote images

### 5. Tree Shaking & Dead Code Elimination

- Enabled `usedExports` and `concatenateModules`
- Module federation for better caching
- Side-effect optimization for common libraries

## Best Practices for Developers

### 1. Use Dynamic Imports for Heavy Components

**❌ Bad:**
```typescript
import { Chart } from '@/components/chart';
import { FlowChart } from 'reactflow';
```

**✅ Good:**
```typescript
import { Chart } from '@/lib/dynamic-imports';
import { FlowChart } from '@/lib/dynamic-imports';
```

### 2. Lazy Load Route-Specific Components

**❌ Bad:**
```typescript
import { AdminPanel } from '@/components/admin/panel';
```

**✅ Good:**
```typescript
const AdminPanel = dynamic(() => import('@/components/admin/panel'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### 3. Use Named Exports for Tree Shaking

**❌ Bad:**
```typescript
import * as Icons from 'lucide-react';
const icon = Icons['user'];
```

**✅ Good:**
```typescript
import { User } from 'lucide-react';
```

### 4. Import Specific Functions from Utility Libraries

**❌ Bad:**
```typescript
import dateFns from 'date-fns';
```

**✅ Good:**
```typescript
import { format } from 'date-fns';
```

### 5. Optimize Third-Party Libraries

Use lightweight alternatives where possible:
- Use `date-fns` instead of `moment.js`
- Use `clsx` + `tailwind-merge` instead of `classnames`
- Use `zod` for runtime validation (tree-shakeable)

### 6. Preload Critical Components

```typescript
import { preloadComponent } from '@/lib/dynamic-imports';

// In a parent component or layout
useEffect(() => {
  // Preload components that will be needed soon
  preloadComponent(() => import('@/components/data/data-chart'));
}, []);
```

## Monitoring Bundle Size

### Run Bundle Analyzer

```bash
npm run analyze
```

This will generate an interactive report showing:
- Bundle sizes for each chunk
- Dependencies and their sizes
- Opportunities for optimization

### Check for Unused Dependencies

```bash
npm run deps:check
```

### Update Dependencies

```bash
npm run deps:update
npm install
```

## Performance Benchmarks

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| First Contentful Paint (FCP) | < 1.5s | TBD |
| Largest Contentful Paint (LCP) | < 2.5s | TBD |
| Time to Interactive (TTI) | < 3.5s | TBD |
| Cumulative Layout Shift (CLS) | < 0.1 | TBD |
| Bundle Size (gzipped) | < 500KB | TBD |

### Measuring Performance

1. **Chrome DevTools** - Lighthouse scores
2. **WebPageTest** - Detailed performance analysis
3. **Next.js built-in analytics** - Build output shows bundle sizes

## Server-Side Optimization

### 1. Enable Compression

The `compress: true` option in `next.config.js` enables gzip compression.

### 2. Static Asset Caching

Cache headers configured for:
- Images: 1 year (immutable)
- JS/CSS: 1 year (immutable)
- Fonts: 1 year (immutable)
- API responses: Configurable via CORS

### 3. Standalone Output

```javascript
output: 'standalone'
```

Reduces server bundle size by excluding unnecessary files.

## Troubleshooting

### Large Bundle Size

1. Run `npm run analyze` to identify large chunks
2. Check for duplicate dependencies (`npm ls`)
3. Ensure dynamic imports are used for heavy components
4. Verify tree shaking is working (check `production` builds only)

### Slow Build Times

1. Disable bundle analyzer in production
2. Use `turbo` mode (already enabled)
3. Consider using `swc` instead of `babel` (already default in Next.js 15)

### Runtime Performance Issues

1. Profile with React DevTools Profiler
2. Check for unnecessary re-renders with `why-did-you-render`
3. Use `React.memo` for expensive components
4. Implement virtualization for long lists (`react-window`)

## Continuous Monitoring

Set up automated monitoring:
- Lighthouse CI for PR checks
- Bundle size tracking in CI/CD
- Performance budgets in `package.json`:

```json
{
  "bundlesize": [
    {
      "path": ".next/static/chunks/pages/*.js",
      "maxSize": "200 kB"
    }
  ]
}
```

## Further Optimization Opportunities

1. **Edge Runtime**: Consider using Edge Runtime for specific routes
2. **ISR**: Implement Incremental Static Regeneration for static content
3. **Route Prefetching**: Already done by Next.js, but can be optimized
4. **Font Optimization**: Use `next/font` for automatic font optimization
5. **Script Optimization**: Use `next/script` with proper loading strategies

## Resources

- [Next.js Performance Documentation](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Webpack Bundle Optimization](https://webpack.js.org/guides/code-splitting/)
- [Web.dev Performance Guides](https://web.dev/performance/)

const path = require('path');
const withNextIntl = require('next-intl/plugin')();
const bundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  output: 'standalone',
  reactStrictMode: process.env.NODE_ENV === 'development', // Enable in dev, disable in production for Stack Auth compatibility
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  // Suppress hydration warnings caused by browser extensions
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  serverExternalPackages: ['pdf-parse', 'ioredis'],
  // Compress responses for better performance
  compress: true,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@stackframe/stack',
      'react-markdown',
      'react-syntax-highlighter',
      '@radix-ui/react-icons',
      'recharts',
      'reactflow',
      'framer-motion',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-accordion',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-toast',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-avatar',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-slider',
      '@radix-ui/react-progress',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-hover-card',
      'sonner',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    // Optimize CSS
    optimizeCss: true,
  },
  // Turbopack configuration (replaces experimental.turbo)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // Security: CORS headers for API routes
  async headers() {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'];

    // CDN URL for asset headers
    const cdnUrl = process.env.CDN_URL || '';

    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://api.mistral.ai https://sa-api.mokka-dev.de https://app.stack-auth.com https://1.1.1.1 wss://sa-api.mokka-dev.de ws://localhost:* wss://localhost:*",
              "frame-src 'self' https://js.stripe.com https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; ')
          },
        ],
      },
      // CORS headers for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigins[0],
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
      // Static assets with long cache headers for CDN
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          ...(cdnUrl ? [{
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          }] : []),
        ],
      },
      // JS/CSS assets with versioning - long cache
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Font files - long cache
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Images with shorter cache for updates
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // Favicon - very long cache
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Robots.txt - short cache
      {
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ];
  },
  // Additional webpack optimizations
  webpack: (config, { isServer, webpack }) => {
    // Fixes for packages that don't support Node.js built-ins
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
      };
    }

    // Note: Let Next.js 15 handle code splitting automatically to avoid chunk loading issues
    // Only set basic optimization options
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        // Enable module concatenation for better performance
        concatenateModules: true,
        // Minimize bundle size
        minimize: true,
      };
    }

    // Tree shaking: mark packages as side-effect free
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: {
        fullySpecified: false,
      },
    });

    // Exclude unused locales from moment.js, date-fns, etc
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Only include needed locales (en, de, es)
        'date-fns/locale': path.resolve(__dirname, 'node_modules/date-fns/locale'),
      };
    }

    // Optimize bundle size with production-specific optimizations
    if (process.env.NODE_ENV === 'production') {
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
      };
    }

    return config;
  },
};

module.exports = withNextIntl(bundleAnalyzer(nextConfig));

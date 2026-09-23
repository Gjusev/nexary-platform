/**
 * CDN Configuration and Utilities
 *
 * Provides utilities for working with CDN for static assets.
 * Supports Cloudflare, AWS CloudFront, and other CDNs.
 */

/**
 * CDN configuration from environment variables.
 */
export interface CDNConfig {
  enabled: boolean;
  url: string;
  provider: 'cloudflare' | 'cloudfront' | 'vercel' | 'custom' | null;
  hostnames: string[];
  cacheTags: boolean;
}

/**
 * Get CDN configuration from environment variables.
 */
export function getCDNConfig(): CDNConfig {
  const cdnUrl = process.env.CDN_URL || '';
  const enabled = !!cdnUrl;
  const provider = (process.env.CDN_PROVIDER as CDNConfig['provider']) || null;

  // Parse CDN_URL to extract hostname
  let hostname = '';
  if (cdnUrl) {
    try {
      const url = new URL(cdnUrl);
      hostname = url.hostname;
    } catch {
      hostname = cdnUrl;
    }
  }

  return {
    enabled,
    url: cdnUrl,
    provider,
    hostnames: hostname ? [hostname] : [],
    cacheTags: process.env.CDN_CACHE_TAGS === 'true',
  };
}

/**
 * Get the CDN URL for a static asset.
 * Returns the asset URL with CDN prefix if enabled.
 */
export function getCDNUrl(path: string): string {
  const config = getCDNConfig();

  if (!config.enabled || !config.url) {
    return path;
  }

  // Ensure path starts with /
  const assetPath = path.startsWith('/') ? path : `/${path}`;

  // Remove trailing slash from CDN URL
  const baseUrl = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;

  return `${baseUrl}${assetPath}`;
}

/**
 * Get cache headers for static assets.
 */
export function getCacheHeaders(assetType: 'static' | 'image' | 'font' | 'api'): Record<string, string> {
  const baseHeaders: Record<string, string> = {};

  switch (assetType) {
    case 'static':
      // Versioned static assets (JS, CSS) - immutable, cache forever
      return {
        'Cache-Control': 'public, max-age=31536000, immutable',
      };

    case 'image':
      // Images - cache for 1 day, stale for 7 days
      return {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      };

    case 'font':
      // Fonts - cache forever
      return {
        'Cache-Control': 'public, max-age=31536000, immutable',
      };

    case 'api':
      // API responses - don't cache by default
      return {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      };

    default:
      return baseHeaders;
  }
}

/**
 * Generate CDN cache tags for an asset.
 * Useful for selective cache invalidation.
 */
export function generateCacheTags(
  type: string,
  identifier?: string
): string[] {
  const tags: string[] = [`type:${type}`];

  if (identifier) {
    tags.push(`id:${identifier}`);
  }

  // Add version tag for cache busting
  if (process.env.NEXT_BUILD_ID) {
    tags.push(`build:${process.env.NEXT_BUILD_ID}`);
  }

  return tags;
}

/**
 * CDN provider-specific configurations.
 */
export const CDN_PROVIDERS = {
  cloudflare: {
    name: 'Cloudflare',
    setupUrl: 'https://developers.cloudflare.com/cache/how-to/cache-static-assets/',
    headers: {
      'Cache-Status': '"Cloudflare"',
    },
  },

  cloudfront: {
    name: 'AWS CloudFront',
    setupUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html',
    headers: {
      'x-amz-cf-id': '',
    },
  },

  vercel: {
    name: 'Vercel Edge Network',
    setupUrl: 'https://vercel.com/docs/concepts/edge-network/caching',
    headers: {
      'x-vercel-cache': 'HIT',
    },
  },
} as const;

/**
 * Check if a request should be served from CDN.
 */
export function shouldUseCDN(request: Request): boolean {
  const config = getCDNConfig();
  if (!config.enabled) {
    return false;
  }

  // Skip CDN for API routes
  if (request.url.includes('/api/')) {
    return false;
  }

  // Skip CDN for authenticated pages
  const cookie = request.headers.get('cookie');
  if (cookie && (cookie.includes('auth') || cookie.includes('session'))) {
    return false;
  }

  return true;
}

/**
 * Get CDN purge URL for cache invalidation.
 */
export function getPurgeUrl(path: string): string | null {
  const config = getCDNConfig();
  if (!config.enabled || !config.url) {
    return null;
  }

  switch (config.provider) {
    case 'cloudflare':
      return `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`;

    case 'cloudfront':
      // CloudFront uses invalidation through AWS SDK
      return null;

    case 'vercel':
      return `https://api.vercel.com/v1/now/${process.env.VERCEL_PROJECT_ID}/cache`;

    default:
      return null;
  }
}

/**
 * Configuration example for environment variables.
 */
export const ENV_EXAMPLE = `
# CDN Configuration
CDN_URL=https://cdn.example.com
CDN_PROVIDER=cloudflare  # Options: cloudflare, cloudfront, vercel, custom
CDN_CACHE_TAGS=true
CLOUDFLARE_ZONE_ID=your-zone-id  # For Cloudflare
VERCEL_PROJECT_ID=your-project-id  # For Vercel
`;

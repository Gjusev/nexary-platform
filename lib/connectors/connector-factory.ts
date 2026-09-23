/**
 * Connector Factory
 * Creates connector instances and provides metadata about supported sources
 */

import type {
  BaseConnector,
  ConnectorAuthConfig,
  ConnectorMetadata,
  ConnectorRegistryEntry
} from './base-connector';

// Re-export commonly used types
export type { ConnectorAuthConfig } from './base-connector';

/**
 * Supported connector types
 */
export type SupportedConnectorType =
  | 'confluence'
  | 'notion'
  | 'sharepoint'
  | 'google_drive'
  | 'slack'
  | 'web'
  | 'database'
  | 'rss'
  | 'sitemap';

/**
 * Connector factory class
 * Creates connector instances and provides metadata about supported sources
 */
export class ConnectorFactory {
  private static registry: Map<string, ConnectorRegistryEntry> = new Map();

  /**
   * Register a connector type
   * @param entry - Connector registry entry with metadata and factory
   */
  static register(entry: ConnectorRegistryEntry): void {
    this.registry.set(entry.metadata.type, entry);
  }

  /**
   * Create a connector instance
   * @param sourceType - Type of connector to create
   * @param config - Authentication configuration
   * @param dataSourceId - Data source ID
   * @returns Connector instance
   * @throws Error if source type not supported
   */
  static create(
    sourceType: SupportedConnectorType | string,
    config: ConnectorAuthConfig,
    dataSourceId: string
  ): BaseConnector {
    const entry = this.registry.get(sourceType);

    if (!entry) {
      throw new Error(
        `Unsupported source type: ${sourceType}. ` +
        `Supported types: ${Array.from(this.registry.keys()).join(', ')}`
      );
    }

    return entry.factory(config, dataSourceId);
  }

  /**
   * Get metadata for all supported sources
   * @returns Array of connector metadata
   */
  static getSupportedSources(): ConnectorMetadata[] {
    return Array.from(this.registry.values()).map(entry => entry.metadata);
  }

  /**
   * Get metadata for a specific source type
   * @param sourceType - Type of connector
   * @returns Connector metadata or undefined if not found
   */
  static getSourceMetadata(sourceType: string): ConnectorMetadata | undefined {
    return this.registry.get(sourceType)?.metadata;
  }

  /**
   * Check if a source type is supported
   * @param sourceType - Type to check
   * @returns True if supported
   */
  static isSupported(sourceType: string): boolean {
    return this.registry.has(sourceType);
  }

  /**
   * Get all source types that support webhooks
   * @returns Array of source types
   */
  static getWebhookSupportedSources(): string[] {
    return Array.from(this.registry.values())
      .filter(entry => entry.metadata.supportsWebhooks)
      .map(entry => entry.metadata.type);
  }

  /**
   * Get all source types that support a specific auth type
   * @param authType - Authentication type
   * @returns Array of source types
   */
  static getSourcesWithAuthType(
    authType: 'oauth' | 'api_key' | 'service_account' | 'basic_auth'
  ): string[] {
    return Array.from(this.registry.values())
      .filter(entry => entry.metadata.authTypes.includes(authType))
      .map(entry => entry.metadata.type);
  }
}

/**
 * Metadata for supported connectors
 * This will be populated as connectors are implemented
 */
export const CONNECTOR_METADATA: Record<string, Omit<ConnectorMetadata, 'type'>> = {
  confluence: {
    name: 'Confluence',
    description: 'Import documents from Atlassian Confluence wiki',
    icon: '📄',
    supportsWebhooks: true,
    authTypes: ['oauth'],
    features: [
      'Page content extraction',
      'Space browsing',
      'Attachment support',
      'Permission mapping',
      'Incremental sync',
      'Version history'
    ],
    rateLimit: { requests: 1000, window: 3600000 } // 1000 per hour
  },

  notion: {
    name: 'Notion',
    description: 'Import pages and databases from Notion',
    icon: '📝',
    supportsWebhooks: false, // Notion has limited webhooks
    authTypes: ['api_key'],
    features: [
      'Page content extraction',
      'Database support',
      'Block-level content',
      'Last edited tracking',
      'Nested pages'
    ],
    rateLimit: { requests: 3, window: 1000 } // 3 requests per second (tier 1)
  },

  sharepoint: {
    name: 'SharePoint',
    description: 'Import documents from Microsoft SharePoint',
    icon: '📂',
    supportsWebhooks: true,
    authTypes: ['oauth'],
    features: [
      'Document library browsing',
      'File content extraction',
      'Folder hierarchy',
      'Permission inheritance',
      'Version tracking'
    ],
    rateLimit: { requests: 10000, window: 10000 } // 10k per 10 seconds
  },

  google_drive: {
    name: 'Google Drive',
    description: 'Import files from Google Drive',
    icon: '🔷',
    supportsWebhooks: true,
    authTypes: ['oauth'],
    features: [
      'File and folder browsing',
      'Multiple file formats',
      'Shared drive support',
      'Permission mapping',
      'Real-time updates'
    ],
    rateLimit: { requests: 1000, window: 100 } // 1000 per 100 seconds
  },

  slack: {
    name: 'Slack',
    description: 'Import messages from Slack channels',
    icon: '💬',
    supportsWebhooks: true,
    authTypes: ['oauth'],
    features: [
      'Channel message extraction',
      'Thread support',
      'User context',
      'File attachments',
      'Reaction tracking'
    ],
    rateLimit: { requests: 1, window: 1000 } // 1 per second (tier 1)
  },

  web: {
    name: 'Web Scraper',
    description: 'Crawl and index web pages',
    icon: '🌐',
    supportsWebhooks: false,
    authTypes: [],
    features: [
      'Configurable depth',
      'Domain filtering',
      'Link following',
      'Rate limiting',
      'JavaScript rendering (optional)'
    ],
    rateLimit: { requests: 1, window: 1000 } // 1 per second (polite crawling)
  },

  database: {
    name: 'Database',
    description: 'Import data from PostgreSQL, MySQL, MongoDB, Snowflake, BigQuery',
    icon: '🗄️',
    supportsWebhooks: false,
    authTypes: ['basic_auth'],
    features: [
      'Custom query support',
      'Multiple database types',
      'Row to document mapping',
      'Incremental sync via timestamps',
      'Large result set pagination'
    ],
    rateLimit: { requests: 100, window: 60000 } // 100 per minute
  },

  rss: {
    name: 'RSS Feed',
    description: 'Import articles from RSS/Atom feeds',
    icon: '📡',
    supportsWebhooks: false,
    authTypes: [],
    features: [
      'Feed parsing',
      'Article extraction',
      'Category support',
      'Publication date tracking',
      'Author attribution'
    ],
    rateLimit: { requests: 10, window: 60000 } // 10 per minute
  },

  sitemap: {
    name: 'Sitemap',
    description: 'Crawl websites using XML sitemaps',
    icon: '🗺️',
    supportsWebhooks: false,
    authTypes: [],
    features: [
      'Sitemap parsing',
      'URL filtering',
      'Priority handling',
      'Change frequency',
      'Multi-level sitemaps'
    ],
    rateLimit: { requests: 5, window: 60000 } // 5 per minute
  }
};

/**
 * Initialize connector factory with connector implementations
 * Concrete connector implementations are registered here
 *
 * @example
 * ```ts
 * import { ConfluenceConnector } from './confluence-connector';
 *
 * ConnectorFactory.register({
 *   metadata: {
 *     type: 'confluence',
 *     ...CONNECTOR_METADATA.confluence
 *   },
 *   factory: (config, dataSourceId) => new ConfluenceConnector(config, dataSourceId)
 * });
 * ```
 */
export async function initializeConnectorFactory(): Promise<void> {
  // Register implemented connectors
  // Dynamic imports to avoid circular dependencies

  // Confluence Connector
  try {
    const { ConfluenceConnector } = await import('./confluence-connector');
    ConnectorFactory.register({
      metadata: { type: 'confluence', ...CONNECTOR_METADATA.confluence },
      factory: (config, dataSourceId) => new ConfluenceConnector(config, dataSourceId)
    });
  } catch (error) {
    console.warn('[Connector Factory] Failed to register Confluence connector:', error);
  }

  // Notion Connector
  try {
    const { NotionConnector } = await import('./notion-connector');
    ConnectorFactory.register({
      metadata: { type: 'notion', ...CONNECTOR_METADATA.notion },
      factory: (config, dataSourceId) => new NotionConnector(config, dataSourceId)
    });
  } catch (error) {
    console.warn('[Connector Factory] Failed to register Notion connector:', error);
  }

  // Web Scraper Connector
  try {
    const { WebConnector } = await import('./web-connector');
    ConnectorFactory.register({
      metadata: { type: 'web', ...CONNECTOR_METADATA.web },
      factory: (config, dataSourceId) => new WebConnector(config, dataSourceId)
    });
  } catch (error) {
    console.warn('[Connector Factory] Failed to register Web connector:', error);
  }

  // TODO: Register additional connectors as they are implemented:
  // - SharePoint
  // - Google Drive
  // - Slack
  // - Database
  // - RSS
  // - Sitemap
}

// Auto-initialize on import (fire and forget - initialization happens in background)
initializeConnectorFactory().catch(error => {
  console.warn('[Connector Factory] Auto-initialization failed:', error);
});

/**
 * Helper function to create connector with automatic error handling
 * @param sourceType - Type of connector
 * @param config - Auth configuration
 * @param dataSourceId - Data source ID
 * @returns Connector instance or null if creation fails
 */
export async function createConnectorSafe(
  sourceType: SupportedConnectorType,
  config: ConnectorAuthConfig,
  dataSourceId: string
): Promise<BaseConnector | null> {
  try {
    return ConnectorFactory.create(sourceType, config, dataSourceId);
  } catch (error) {
    console.error(`Failed to create connector for type ${sourceType}:`, error);
    return null;
  }
}

/**
 * Validate connector configuration
 * @param sourceType - Type of connector
 * @param config - Config to validate
 * @returns True if valid, false with error message otherwise
 */
export function validateConnectorConfig(
  sourceType: string,
  config: Record<string, unknown>
): { valid: boolean; error?: string } {
  const metadata = ConnectorFactory.getSourceMetadata(sourceType);

  if (!metadata) {
    return { valid: false, error: `Unknown source type: ${sourceType}` };
  }

  // Check auth type
  if (config.authType && !metadata.authTypes.includes(config.authType as any)) {
    return {
      valid: false,
      error: `Auth type ${config.authType} not supported. Supported: ${metadata.authTypes.join(', ')}`
    };
  }

  // Source-specific validation
  switch (sourceType) {
    case 'web':
      if (!config.urls || !Array.isArray(config.urls) || config.urls.length === 0) {
        return { valid: false, error: 'Web scraper requires at least one URL' };
      }
      break;

    case 'database':
      if (!config.connectionString) {
        return { valid: false, error: 'Database connector requires connectionString' };
      }
      if (!config.dbType) {
        return { valid: false, error: 'Database connector requires dbType (postgresql, mysql, mongodb, etc.)' };
      }
      break;

    case 'rss':
      if (!config.feedUrl) {
        return { valid: false, error: 'RSS connector requires feedUrl' };
      }
      break;

    case 'sitemap':
      if (!config.sitemapUrl) {
        return { valid: false, error: 'Sitemap connector requires sitemapUrl' };
      }
      break;
  }

  return { valid: true };
}

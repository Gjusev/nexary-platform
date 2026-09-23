/**
 * Base Connector Interface
 * All source connectors must implement this abstract class
 */

import { randomUUID } from 'crypto';

/**
 * Authentication configuration for data sources
 */
export interface ConnectorAuthConfig {
  type: 'oauth' | 'api_key' | 'service_account' | 'basic_auth' | 'none';
  credentials: Record<string, string> | Record<string, unknown>;
  baseUrl?: string; // For on-premise solutions like Confluence, SharePoint
  urls?: string[]; // For web scraping
  maxDepth?: number;
  maxPages?: number;
  allowedDomains?: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  followLinks?: boolean;
  respectRobotsTxt?: boolean;
  userAgent?: string;
  timeout?: number;
}

/**
 * External document representation
 */
export interface ExternalDocument {
  externalId: string;
  externalUrl?: string;
  title: string;
  content: string;
  contentType?: string;
  author?: {
    name?: string;
    email?: string;
    id?: string;
  };
  updatedAt: Date;
  metadata: Record<string, unknown>;
  permissions?: Array<{
    principalId: string;
    permissionLevel: 'read' | 'write' | 'admin' | 'owner';
  }>;
}

/**
 * Options for fetching documents
 */
export interface SyncOptions {
  fullSync?: boolean;
  since?: Date; // For incremental sync
  limit?: number;
  includeDeleted?: boolean;
}

/**
 * Webhook event representation
 */
export interface WebhookEvent {
  eventType: 'created' | 'updated' | 'deleted';
  documentId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  latency?: number; // Response time in ms
}

/**
 * Change tracking entry
 */
export interface DocumentChange {
  externalId: string;
  changeType: 'created' | 'updated' | 'deleted';
  timestamp: Date;
  previousVersion?: string;
  newVersion?: string;
}

/**
 * Sync result statistics
 */
export interface SyncResult {
  documentsCreated: number;
  documentsUpdated: number;
  documentsDeleted: number;
  documentsFailed: number;
  errors: Array<{ documentId: string; error: string }>;
  duration: number; // milliseconds
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  requests: number;
  window: number; // milliseconds
}

/**
 * Formatted document for internal processing
 */
export interface FormattedDocument {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
}

/**
 * Abstract base class for all source connectors
 *
 * @example
 * ```ts
 * class ConfluenceConnector extends BaseConnector {
 *   readonly sourceType = 'confluence';
 *
 *   async authenticate(): Promise<boolean> {
 *     // OAuth flow implementation
 *   }
 *
 *   async fetchDocuments(options: SyncOptions): Promise<ExternalDocument[]> {
 *     // Fetch pages from Confluence
 *   }
 *
 *   // ... implement other required methods
 * }
 * ```
 */
export abstract class BaseConnector {
  protected config: ConnectorAuthConfig;
  protected dataSourceId: string;

  /**
   * Source type identifier (e.g., 'confluence', 'notion')
   */
  abstract readonly sourceType: string;

  constructor(config: ConnectorAuthConfig, dataSourceId: string) {
    this.config = config;
    this.dataSourceId = dataSourceId;
  }

  // ========== Authentication ==========

  /**
   * Authenticate with the external source
   * @returns True if authentication successful
   */
  abstract authenticate(): Promise<boolean>;

  /**
   * Refresh authentication credentials (for OAuth)
   * @throws Error if refresh fails
   */
  abstract refreshCredentials(): Promise<void>;

  /**
   * Validate connection health
   * @returns Health check result with latency
   */
  abstract validateConnection(): Promise<HealthCheckResult>;

  // ========== Document Fetching ==========

  /**
   * Fetch documents from the source
   * @param options - Sync options (full/incremental, limit, etc.)
   * @returns Array of external documents
   */
  abstract fetchDocuments(options: SyncOptions): Promise<ExternalDocument[]>;

  /**
   * Fetch a single document by external ID
   * @param externalId - External document identifier
   * @returns Document or null if not found
   */
  abstract fetchDocument(externalId: string): Promise<ExternalDocument | null>;

  /**
   * List available documents without fetching content
   * Useful for building document browsers
   * @param options - Sync options
   * @returns Array of document metadata
   */
  abstract listDocuments(options: SyncOptions): Promise<Array<{
    externalId: string;
    title: string;
    updatedAt: Date;
    url?: string;
  }>>;

  // ========== Change Detection ==========

  /**
   * Get changes since a specific timestamp
   * @param since - Only return changes after this date
   * @returns Array of document changes
   */
  abstract getChanges(since: Date): Promise<DocumentChange[]>;

  // ========== Webhooks ==========

  /**
   * Check if this connector supports webhooks
   */
  abstract supportsWebhooks(): boolean;

  /**
   * Setup webhook for real-time updates
   * @param endpointUrl - Your webhook URL to receive events
   * @returns Webhook ID/subscription ID
   */
  abstract setupWebhook(endpointUrl: string): Promise<string>;

  /**
   * Handle incoming webhook event
   * @param event - Webhook event data
   * @returns Document if event relates to a document, null otherwise
   */
  abstract handleWebhook(event: WebhookEvent): Promise<ExternalDocument | null>;

  /**
   * Delete webhook subscription
   * @param webhookId - Webhook ID from setupWebhook
   */
  abstract deleteWebhook(webhookId: string): Promise<boolean>;

  // ========== Rate Limiting ==========

  /**
   * Get rate limit configuration
   * @returns Rate limit (requests per window)
   */
  abstract getRateLimit(): RateLimit;

  /**
   * Check rate limit and wait if necessary
   * Implementers should track request counts and wait if limit exceeded
   */
  protected abstract checkRateLimit(): Promise<void>;

  // ========== Error Handling ==========

  /**
   * Handle connector errors
   * Implementers should log errors and decide whether to retry or fail
   * @param error - The error that occurred
   * @param context - Context where error occurred (e.g., 'fetchDocuments', 'authenticate')
   */
  protected abstract handleError(error: unknown, context: string): void;

  // ========== Utilities ==========

  /**
   * Format external document for internal processing
   * Override this for custom formatting logic
   * @param doc - External document
   * @returns Formatted document
   */
  formatDocument(doc: ExternalDocument): FormattedDocument {
    return {
      title: doc.title,
      content: doc.content,
      metadata: {
        externalUrl: doc.externalUrl,
        externalUpdatedAt: doc.updatedAt.toISOString(),
        author: doc.author,
        ...doc.metadata
      },
      tags: []
    };
  }

  /**
   * Generate a unique internal ID for an external document
   * @param externalId - External document ID
   * @returns Internal UUID
   */
  generateInternalId(externalId: string): string {
    return randomUUID();
  }

  /**
   * Extract plain text from HTML content
   * @param html - HTML string
   * @returns Plain text
   */
  protected htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Sanitize filename for safe storage
   * @param filename - Original filename
   * @returns Sanitized filename
   */
  protected sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
      .substring(0, 255); // Limit length
  }

  /**
   * Extract domain from URL for source identification
   * @param url - URL string
   * @returns Domain name
   */
  protected extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Convert bytes to human-readable format
   * @param bytes - Size in bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Safe JSON parse with fallback
   * @param json - JSON string
   * @param fallback - Fallback value if parse fails
   * @returns Parsed object or fallback
   */
  protected safeJsonParse<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Calculate age of a date in human-readable format
   * @param date - Date to calculate age from
   * @returns Formatted age string (e.g., "2 hours ago")
   */
  protected getAge(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  }
}

/**
 * Connector metadata for UI display
 */
export interface ConnectorMetadata {
  type: string;
  name: string;
  description: string;
  icon?: string; // Icon name or URL
  supportsWebhooks: boolean;
  authTypes: Array<'oauth' | 'api_key' | 'service_account' | 'basic_auth'>;
  features: string[];
  rateLimit?: RateLimit;
}

/**
 * Connector registry entry
 */
export interface ConnectorRegistryEntry {
  metadata: ConnectorMetadata;
  factory: (config: ConnectorAuthConfig, dataSourceId: string) => BaseConnector;
}

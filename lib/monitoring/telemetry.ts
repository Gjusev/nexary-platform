/**
 * Telemetry and Metrics Collection System
 *
 * Provides centralized metrics collection for monitoring business KPIs,
 * system performance, and user behavior. Integrates with Datadog and Sentry.
 */

import * as Sentry from '@sentry/nextjs';

export interface MetricOptions {
  /** Metric name */
  name: string;
  /** Metric value (for gauges and histograms) */
  value?: number;
  /** Tags for filtering and grouping */
  tags?: Record<string, string>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface Timer {
  /** Stop the timer and record the duration */
  stop: () => number;
}

/**
 * Telemetry client for collecting metrics and traces
 */
export class TelemetryClient {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'production' || process.env.ENABLE_TELEMETRY === 'true';
  }

  /**
   * Record a counter metric (increments by 1)
   */
  increment(name: string, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    try {
      // Send to Sentry as a breadcrumb
      Sentry.addBreadcrumb({
        category: 'metric',
        message: `Counter: ${name}`,
        level: 'info',
        data: { tags, value: 1 },
      });

      // Send to Datadog if configured
      if (process.env.DATADOG_API_KEY) {
        // In a real implementation, you would use the Datadog metrics client here
        // For now, we'll just log it
        console.log(`[Telemetry] Counter: ${name}`, { tags });
      }
    } catch (error) {
      console.error('[Telemetry] Failed to increment metric:', error);
    }
  }

  /**
   * Record a gauge metric (current value)
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    try {
      // Send to Sentry as a breadcrumb
      Sentry.addBreadcrumb({
        category: 'metric',
        message: `Gauge: ${name}`,
        level: 'info',
        data: { tags, value },
      });

      // Send to Datadog if configured
      if (process.env.DATADOG_API_KEY) {
        console.log(`[Telemetry] Gauge: ${name} = ${value}`, { tags });
      }
    } catch (error) {
      console.error('[Telemetry] Failed to record gauge:', error);
    }
  }

  /**
   * Record a timing metric (duration in milliseconds)
   */
  timing(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    try {
      // Send to Sentry as a breadcrumb
      Sentry.addBreadcrumb({
        category: 'metric',
        message: `Timing: ${name}`,
        level: 'info',
        data: { tags, value },
      });

      // Send to Datadog if configured
      if (process.env.DATADOG_API_KEY) {
        console.log(`[Telemetry] Timing: ${name} = ${value}ms`, { tags });
      }
    } catch (error) {
      console.error('[Telemetry] Failed to record timing:', error);
    }
  }

  /**
   * Start a timer for measuring duration
   */
  startTimer(name: string, tags?: Record<string, string>): Timer {
    const startTime = Date.now();

    return {
      stop: () => {
        const duration = Date.now() - startTime;
        this.timing(name, duration, tags);
        return duration;
      },
    };
  }

  /**
   * Record a business event
   */
  recordEvent(name: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    try {
      // Send to Sentry as a breadcrumb
      Sentry.addBreadcrumb({
        category: 'business_event',
        message: name,
        level: 'info',
        data: metadata,
      });

      // Log to console
      console.log(`[Telemetry] Event: ${name}`, { metadata });
    } catch (error) {
      console.error('[Telemetry] Failed to record event:', error);
    }
  }

  /**
   * Set user context for better tracking
   */
  setUser(userId: string, email?: string, traits?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    try {
      Sentry.setUser({
        id: userId,
        email,
        ...traits,
      });
    } catch (error) {
      console.error('[Telemetry] Failed to set user:', error);
    }
  }

  /**
   * Clear user context (e.g., on logout)
   */
  clearUser(): void {
    try {
      Sentry.setUser(null);
    } catch (error) {
      console.error('[Telemetry] Failed to clear user:', error);
    }
  }
}

/**
 * Global telemetry instance
 */
export const telemetry = new TelemetryClient();

/**
 * Predefined metric names for consistency
 */
export const Metrics = {
  // Authentication
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILURE: 'auth.login.failure',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',

  // Chat
  CHAT_MESSAGE_SENT: 'chat.message.sent',
  CHAT_CONVERSATION_CREATED: 'chat.conversation.created',
  CHAT_TOKEN_USAGE: 'chat.token.usage',
  CHAT_RESPONSE_TIME: 'chat.response.time',

  // RAG
  RAG_DOCUMENT_UPLOAD: 'rag.document.upload',
  RAG_DOCUMENT_PROCESSED: 'rag.document.processed',
  RAG_QUERY_PERFORMED: 'rag.query.performed',
  RAG_EMBEDDING_GENERATED: 'rag.embedding.generated',

  // Team
  TEAM_CREATED: 'team.created',
  TEAM_MEMBER_ADDED: 'team.member.added',
  TEAM_INVITE_SENT: 'team.invite.sent',

  // Database
  DB_QUERY_EXECUTED: 'db.query.executed',
  DB_QUERY_TIME: 'db.query.time',
  DB_CONNECTION_POOL_SIZE: 'db.connection_pool.size',

  // Cache
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_SET: 'cache.set',

  // Storage
  STORAGE_FILE_UPLOADED: 'storage.file.uploaded',
  STORAGE_FILE_DOWNLOADED: 'storage.file.downloaded',

  // API
  API_REQUEST: 'api.request',
  API_RESPONSE_TIME: 'api.response.time',
  API_ERROR: 'api.error',
} as const;

/**
 * Helper to track API requests
 */
export function trackApiRequest(
  route: string,
  method: string,
  statusCode: number,
  duration: number
): void {
  telemetry.timing(Metrics.API_RESPONSE_TIME, duration, {
    route,
    method,
    status: statusCode.toString(),
  });

  telemetry.increment(Metrics.API_REQUEST, {
    route,
    method,
    status: statusCode.toString(),
  });

  if (statusCode >= 400) {
    telemetry.increment(Metrics.API_ERROR, {
      route,
      method,
      status: statusCode.toString(),
    });
  }
}

/**
 * Helper to track database queries
 */
export function trackDatabaseQuery(
  table: string,
  operation: string,
  duration: number,
  success: boolean
): void {
  telemetry.timing(Metrics.DB_QUERY_TIME, duration, {
    table,
    operation,
    success: success.toString(),
  });

  telemetry.increment(Metrics.DB_QUERY_EXECUTED, {
    table,
    operation,
    success: success.toString(),
  });
}

/**
 * Helper to track cache operations
 */
export function trackCacheOperation(
  operation: 'hit' | 'miss' | 'set',
  key: string
): void {
  telemetry.increment(
    operation === 'hit' ? Metrics.CACHE_HIT : operation === 'miss' ? Metrics.CACHE_MISS : Metrics.CACHE_SET,
    { key_pattern: key.substring(0, 50) }
  );
}

/**
 * Helper to track chat operations
 */
export function trackChatMessage(
  tokensUsed: number,
  responseTime: number,
  provider: string
): void {
  telemetry.gauge(Metrics.CHAT_TOKEN_USAGE, tokensUsed, { provider });
  telemetry.timing(Metrics.CHAT_RESPONSE_TIME, responseTime, { provider });
  telemetry.increment(Metrics.CHAT_MESSAGE_SENT, { provider });
}

/**
 * Helper to track RAG operations
 */
export function trackRAGDocumentProcessing(
  fileSize: number,
  processingTime: number,
  pageCount?: number
): void {
  telemetry.timing('rag.document.processing_time', processingTime);
  telemetry.gauge('rag.document.file_size', fileSize);
  if (pageCount) {
    telemetry.gauge('rag.document.page_count', pageCount);
  }
  telemetry.increment(Metrics.RAG_DOCUMENT_PROCESSED);
}

/**
 * Structured Logger with Pino
 *
 * Production-ready structured logging that outputs JSON for log aggregation.
 * Integrates with log management systems (Datadog, Splunk, etc.).
 */

import pino from 'pino';

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Log context interface
export interface LogContext {
  [key: string]: unknown;
  requestId?: string;
  userId?: string;
  teamSlug?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
    name?: string;
  };
}

/**
 * Structured Logger class
 */
export class StructuredLogger {
  private logger: pino.Logger;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';

    // Configure Pino
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      // Pretty print in development, JSON in production
      transport: this.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      // Base fields for all logs
      base: {
        env: process.env.NODE_ENV || 'unknown',
        app: 'nexary',
        version: process.env.npm_package_version || '0.1.0',
      },
      // Redact sensitive data
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.password',
          'req.token',
          'user.email',
          'user.ip',
        ],
        remove: true,
      },
      // Timestamp
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  /**
   * Create child logger with preset context
   */
  child(context: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(context || {}, message);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(context || {}, message);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(context || {}, message);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | LogContext, context?: LogContext): void {
    let logContext: LogContext = context || {};

    if (error instanceof Error) {
      logContext = {
        ...logContext,
        error: {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          name: error.name,
        },
      };
    } else if (error) {
      logContext = { ...logContext, ...error };
    }

    this.logger.error(logContext, message);
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, error?: Error | LogContext, context?: LogContext): void {
    let logContext: LogContext = context || {};

    if (error instanceof Error) {
      logContext = {
        ...logContext,
        error: {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          name: error.name,
        },
      };
    } else if (error) {
      logContext = { ...logContext, ...error };
    }

    this.logger.fatal(logContext, message);
  }

  /**
   * Log HTTP request
   */
  logRequest(context: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    requestId?: string;
    userId?: string;
    userAgent?: string;
    ip?: string;
  }): void {
    this.info('HTTP Request', {
      type: 'http_request',
      method: context.method,
      url: context.url,
      status_code: context.statusCode,
      duration_ms: context.duration,
      request_id: context.requestId,
      user_id: context.userId,
      user_agent: context.userAgent,
      ip: context.ip,
    });
  }

  /**
   * Log database query
   */
  logQuery(context: {
    table: string;
    operation: string;
    duration: number;
    rowCount?: number;
    success: boolean;
  }): void {
    this.debug('Database Query', {
      type: 'db_query',
      table: context.table,
      operation: context.operation,
      duration_ms: context.duration,
      row_count: context.rowCount,
      success: context.success,
    });
  }

  /**
   * Log cache operation
   */
  logCache(context: {
    operation: 'get' | 'set' | 'delete' | 'hit' | 'miss';
    key: string;
    ttl?: number;
    duration?: number;
  }): void {
    this.debug('Cache Operation', {
      type: 'cache_operation',
      operation: context.operation,
      key: context.key.substring(0, 50), // Limit key length
      ttl: context.ttl,
      duration_ms: context.duration,
    });
  }

  /**
   * Log AI provider call
   */
  logAICall(context: {
    provider: string;
    model: string;
    tokensUsed?: number;
    duration: number;
    success: boolean;
    errorMessage?: string;
  }): void {
    this.info('AI Provider Call', {
      type: 'ai_call',
      provider: context.provider,
      model: context.model,
      tokens_used: context.tokensUsed,
      duration_ms: context.duration,
      success: context.success,
      error_message: context.errorMessage,
    });
  }

  /**
   * Log RAG operation
   */
  logRAG(context: {
    operation: 'upload' | 'process' | 'query' | 'embed';
    packageId?: string;
    documentCount?: number;
    chunkCount?: number;
    duration: number;
    success: boolean;
  }): void {
    this.info('RAG Operation', {
      type: 'rag_operation',
      operation: context.operation,
      package_id: context.packageId,
      document_count: context.documentCount,
      chunk_count: context.chunkCount,
      duration_ms: context.duration,
      success: context.success,
    });
  }

  /**
   * Log authentication event
   */
  logAuth(context: {
    action: 'login' | 'logout' | 'register' | 'password_reset';
    userId?: string;
    method?: string;
    success: boolean;
    failureReason?: string;
  }): void {
    this.info('Authentication Event', {
      type: 'auth_event',
      action: context.action,
      user_id: context.userId,
      method: context.method,
      success: context.success,
      failure_reason: context.failureReason,
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(context: {
    event: string;
    userId?: string;
    teamSlug?: string;
    properties?: Record<string, unknown>;
  }): void {
    this.info('Business Event', {
      type: 'business_event',
      event: context.event,
      user_id: context.userId,
      team_slug: context.teamSlug,
      ...context.properties,
    });
  }
}

/**
 * Global structured logger instance
 */
export const structuredLogger = new StructuredLogger();

/**
 * Create domain-specific loggers
 */
export const createStructuredLogger = (domain: string) => {
  return structuredLogger.child({ domain });
};

/**
 * Pre-configured loggers for common domains
 */
export const structuredLoggers = {
  api: createStructuredLogger('api'),
  db: createStructuredLogger('database'),
  rag: createStructuredLogger('rag'),
  auth: createStructuredLogger('auth'),
  cache: createStructuredLogger('cache'),
  ai: createStructuredLogger('ai'),
  storage: createStructuredLogger('storage'),
  web: createStructuredLogger('web'),
  monitoring: createStructuredLogger('monitoring'),
} as const;

/**
 * Request tracking middleware helper
 */
export class RequestTracker {
  private requestId: string;
  private startTime: number;

  constructor(requestId?: string) {
    this.requestId = requestId || this.generateRequestId();
    this.startTime = Date.now();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  getRequestId(): string {
    return this.requestId;
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  createLogger(): StructuredLogger {
    return structuredLogger.child({
      requestId: this.requestId,
      startTime: new Date(this.startTime).toISOString(),
    });
  }
}

export default structuredLogger;

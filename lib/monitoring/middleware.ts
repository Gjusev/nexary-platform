/**
 * Monitoring Middleware
 *
 * Provides automatic tracking of API requests, performance metrics,
 * and error monitoring for all API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger, structuredLoggers, RequestTracker } from './structured-logger';
import { telemetry, trackApiRequest } from './telemetry';

export interface MonitoringContext {
  requestId: string;
  route: string;
  method: string;
  startTime: number;
  userId?: string;
}

/**
 * Creates a request tracker with automatic logging
 */
export function createRequestTracker(request: NextRequest): RequestTracker {
  const requestId = request.headers.get('x-request-id') || undefined;
  return new RequestTracker(requestId);
}

/**
 * Wraps an API route handler with monitoring
 */
export function withMonitoring<T extends NextResponse>(
  handler: (req: NextRequest, context: MonitoringContext) => Promise<T> | T
): (req: NextRequest) => Promise<T> {
  return async (req: NextRequest) => {
    const tracker = createRequestTracker(req);
    const logger = tracker.createLogger();
    const startTime = Date.now();

    const route = new URL(req.url).pathname;
    const method = req.method;

    const monitoringContext: MonitoringContext = {
      requestId: tracker.getRequestId(),
      route,
      method,
      startTime,
    };

    // Log request start
    logger.debug('Request started', {
      method,
      route,
      user_agent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    });

    try {
      // Execute handler
      const response = await handler(req, monitoringContext);

      // Calculate duration
      const duration = tracker.getDuration();

      // Log request completion
      logger.logRequest({
        method,
        url: route,
        statusCode: response.status,
        duration,
        requestId: tracker.getRequestId(),
      });

      // Track metrics
      trackApiRequest(route, method, response.status, duration);

      // Add request ID to response headers
      response.headers.set('x-request-id', tracker.getRequestId());

      return response;
    } catch (error) {
      // Calculate duration
      const duration = tracker.getDuration();

      // Log error
      logger.error('Request failed', error instanceof Error ? error : undefined, {
        method,
        route,
        duration,
        request_id: tracker.getRequestId(),
      });

      // Track error metrics
      telemetry.increment('api.error', {
        route,
        method,
        error_type: error instanceof Error ? error.name : 'unknown',
      });

      // Re-throw to be handled by error handler
      throw error;
    }
  };
}

/**
 * Wraps a server action with monitoring
 */
export function withActionMonitoring<T>(
  actionName: string,
  handler: (...args: unknown[]) => Promise<T>
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]) => {
    const tracker = new RequestTracker();
    const logger = tracker.createLogger().child({ action: actionName });
    const startTime = Date.now();

    logger.debug('Action started', { action: actionName });

    try {
      const result = await handler(...args);
      const duration = tracker.getDuration();

      logger.info('Action completed', {
        action: actionName,
        duration_ms: duration,
      });

      telemetry.timing('server_action.duration', duration, {
        action: actionName,
        success: 'true',
      });

      return result;
    } catch (error) {
      const duration = tracker.getDuration();

      logger.error('Action failed', error instanceof Error ? error : undefined, {
        action: actionName,
        duration_ms: duration,
      });

      telemetry.increment('server_action.error', {
        action: actionName,
        error_type: error instanceof Error ? error.name : 'unknown',
      });

      throw error;
    }
  };
}

/**
 * Extract user ID from request
 */
export async function extractUserId(req: NextRequest): Promise<string | undefined> {
  try {
    // Try to get user from Stack Auth session
    const { StackServerApp } = await import('@stackframe/stack');
    const stackServerApp = new StackServerApp({ tokenStore: 'nextjs-cookie' });
    const user = await stackServerApp.getUser();
    return user?.id || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Create monitoring context from request
 */
export async function createMonitoringContext(req: NextRequest): Promise<MonitoringContext> {
  const tracker = createRequestTracker(req);
  const route = new URL(req.url).pathname;
  const method = req.method;

  return {
    requestId: tracker.getRequestId(),
    route,
    method,
    startTime: Date.now(),
    userId: await extractUserId(req),
  };
}

/**
 * Monitor database queries
 */
export function monitorDbQuery<T>(
  table: string,
  operation: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return queryFn()
    .then((result) => {
      const duration = Date.now() - startTime;

      structuredLoggers.db.logQuery({
        table,
        operation,
        duration,
        success: true,
      });

      telemetry.timing('db.query.duration', duration, {
        table,
        operation,
        success: 'true',
      });

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;

      structuredLoggers.db.error('Database query failed', error, {
        table,
        operation,
        duration,
      });

      telemetry.increment('db.query.error', {
        table,
        operation,
        error_type: error.name || 'unknown',
      });

      throw error;
    });
}

/**
 * Monitor cache operations
 */
export function monitorCacheOperation<T>(
  operation: 'get' | 'set' | 'delete',
  key: string,
  cacheFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return cacheFn()
    .then((result) => {
      const duration = Date.now() - startTime;
      const hit = operation === 'get' && result !== null && result !== undefined;

      structuredLoggers.cache.logCache({
        operation: hit ? 'hit' : operation,
        key,
        duration,
      });

      telemetry.increment(hit ? 'cache.hit' : 'cache.miss', {
        key_pattern: key.substring(0, 50),
      });

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;

      structuredLoggers.cache.error('Cache operation failed', error, {
        operation,
        key,
        duration,
      });

      throw error;
    });
}

/**
 * Monitor AI provider calls
 */
export function monitorAICall<T>(
  provider: string,
  model: string,
  callFn: () => Promise<{ result: T; tokensUsed?: number }>
): Promise<{ result: T; tokensUsed?: number }> {
  const startTime = Date.now();

  return callFn()
    .then(({ result, tokensUsed }) => {
      const duration = Date.now() - startTime;

      structuredLoggers.ai.logAICall({
        provider,
        model,
        tokensUsed,
        duration,
        success: true,
      });

      telemetry.gauge('ai.tokens_used', tokensUsed || 0, {
        provider,
        model,
      });

      telemetry.timing('ai.call_duration', duration, {
        provider,
        model,
      });

      return { result, tokensUsed };
    })
    .catch((error) => {
      const duration = Date.now() - startTime;

      structuredLoggers.ai.error('AI call failed', error, {
        provider,
        model,
        duration,
      });

      telemetry.increment('ai.call_error', {
        provider,
        model,
        error_type: error.name || 'unknown',
      });

      throw error;
    });
}

/**
 * Monitor RAG operations
 */
export function monitorRAGOperation<T>(
  operation: 'upload' | 'process' | 'query' | 'embed',
  ragFn: () => Promise<T>,
  context?: {
    packageId?: string;
    documentCount?: number;
  }
): Promise<T> {
  const startTime = Date.now();

  return ragFn()
    .then((result) => {
      const duration = Date.now() - startTime;

      structuredLoggers.rag.logRAG({
        operation,
        packageId: context?.packageId,
        documentCount: context?.documentCount,
        duration,
        success: true,
      });

      telemetry.timing('rag.operation.duration', duration, {
        operation,
      });

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;

      structuredLoggers.rag.error('RAG operation failed', error, {
        operation,
        packageId: context?.packageId,
        duration,
      });

      telemetry.increment('rag.operation.error', {
        operation,
        error_type: error.name || 'unknown',
      });

      throw error;
    });
}

/**
 * Monitor storage operations
 */
export function monitorStorageOperation<T>(
  operation: 'upload' | 'download' | 'delete',
  key: string,
  storageFn: () => Promise<T>,
  fileSize?: number
): Promise<T> {
  const startTime = Date.now();

  return storageFn()
    .then((result) => {
      const duration = Date.now() - startTime;

      structuredLoggers.storage.info('Storage operation completed', {
        operation,
        key,
        duration_ms: duration,
        file_size: fileSize,
        success: true,
      });

      telemetry.timing('storage.operation.duration', duration, {
        operation,
      });

      if (fileSize) {
        telemetry.gauge('storage.file_size', fileSize, { operation });
      }

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;

      structuredLoggers.storage.error('Storage operation failed', error, {
        operation,
        key,
        duration,
      });

      telemetry.increment('storage.operation.error', {
        operation,
        error_type: error.name || 'unknown',
      });

      throw error;
    });
}

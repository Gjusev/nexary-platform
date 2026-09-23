/**
 * Centralized error handling system for API routes.
 *
 * Provides consistent error responses across all API endpoints.
 * Integrates with Sentry for error tracking and monitoring.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ErrorMessages, type ErrorMessageKey } from './error-messages';
import * as Sentry from '@sentry/nextjs';

/**
 * HTTP status codes.
 */
export const HttpStatusCode = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  PAYMENT_REQUIRED: 402,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];

/**
 * Custom API error class.
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER_ERROR,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Convert error to NextResponse.
   */
  toJSON() {
    const result: Record<string, unknown> = {
      error: this.message,
      code: this.code,
    };
    if (this.details !== undefined) {
      result.details = this.details;
    }
    return result;
  }
}

/**
 * Validation error for invalid input.
 */
export class ValidationError extends ApiError {
  constructor(message: string = ErrorMessages.INVALID_INPUT, details?: unknown) {
    super(message, HttpStatusCode.BAD_REQUEST, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error for unauthorized access.
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = ErrorMessages.UNAUTHORIZED) {
    super(message, HttpStatusCode.UNAUTHORIZED, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error for forbidden access.
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = ErrorMessages.FORBIDDEN) {
    super(message, HttpStatusCode.FORBIDDEN, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error for missing resources.
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} ${ErrorMessages.NOT_FOUND}`, HttpStatusCode.NOT_FOUND, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error.
 */
export class RateLimitError extends ApiError {
  constructor(message: string = ErrorMessages.RATE_LIMITED) {
    super(message, HttpStatusCode.TOO_MANY_REQUESTS, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

/**
 * AI Service specific errors
 */

/**
 * Insufficient credits error for AI services.
 */
export class InsufficientCreditsError extends ApiError {
  constructor(
    public provider: string,
    message?: string
  ) {
    super(
      message || `Insufficient credits for ${provider}. Please top up your account.`,
      HttpStatusCode.PAYMENT_REQUIRED,
      'INSUFFICIENT_CREDITS',
      { provider }
    );
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Model not available error.
 */
export class ModelNotAvailableError extends ApiError {
  constructor(
    public provider: string,
    public model: string,
    message?: string
  ) {
    super(
      message || `Model ${model} is not available on ${provider}. Please try a different model.`,
      HttpStatusCode.SERVICE_UNAVAILABLE,
      'MODEL_NOT_AVAILABLE',
      { provider, model }
    );
    this.name = 'ModelNotAvailableError';
  }
}

/**
 * Model deprecated error.
 */
export class ModelDeprecatedError extends ApiError {
  constructor(
    public provider: string,
    public model: string,
    public suggestedAlternatives: string[],
    message?: string
  ) {
    super(
      message || `Model ${model} is deprecated on ${provider}. Consider using: ${suggestedAlternatives.join(', ')}`,
      HttpStatusCode.BAD_REQUEST,
      'MODEL_DEPRECATED',
      { provider, model, suggestedAlternatives }
    );
    this.name = 'ModelDeprecatedError';
  }
}

/**
 * AI API key invalid or missing error.
 */
export class AIProviderError extends ApiError {
  constructor(
    public provider: string,
    message?: string
  ) {
    super(
      message || `${provider} API key is invalid or not configured. Please check your settings.`,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      'AI_PROVIDER_ERROR',
      { provider }
    );
    this.name = 'AIProviderError';
  }
}

/**
 * Content filter error (e.g., safety filters, policy violations).
 */
export class ContentFilterError extends ApiError {
  constructor(
    public provider: string,
    public reason: string,
    message?: string
  ) {
    super(
      message || `Content filtered by ${provider}: ${reason}`,
      HttpStatusCode.BAD_REQUEST,
      'CONTENT_FILTER',
      { provider, reason }
    );
    this.name = 'ContentFilterError';
  }
}

/**
 * Context length exceeded error.
 */
export class ContextLengthExceededError extends ApiError {
  constructor(
    public provider: string,
    public model: string,
    public maxLength: number,
    public actualLength: number,
    message?: string
  ) {
    super(
      message || `Conversation too long for ${model} (max: ${maxLength} tokens, current: ${actualLength}). Please start a new conversation.`,
      HttpStatusCode.BAD_REQUEST,
      'CONTEXT_LENGTH_EXCEEDED',
      { provider, model, maxLength, actualLength }
    );
    this.name = 'ContextLengthExceededError';
  }
}

/**
 * Handle unknown errors and convert to appropriate API response.
 *
 * @param error - Unknown error
 * @returns NextResponse with error information
 */
export function handleApiError(error: unknown): NextResponse {
  // Log to console for development
  console.error('[API Error]:', error);

  // Send to Sentry for error tracking
  if (error instanceof Error) {
    Sentry.captureException(error, {
      tags: {
        errorType: error.name,
      },
      extra: {
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
  } else {
    Sentry.captureException(new Error(String(error)));
  }

  // ApiError instances
  if (error instanceof ApiError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError(
      'Validation error',
      error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }))
    );
    return NextResponse.json(validationError.toJSON(), { status: validationError.statusCode });
  }

  // Standard Error
  if (error instanceof Error) {
    // Don't expose stack traces in production
    const isDev = process.env.NODE_ENV === 'development';
    const apiError = new ApiError(
      isDev ? error.message : ErrorMessages.INTERNAL_ERROR,
      HttpStatusCode.INTERNAL_SERVER_ERROR
    );
    return NextResponse.json(
      {
        error: apiError.message,
        ...(isDev && { stack: error.stack }),
      },
      { status: apiError.statusCode }
    );
  }

  // Unknown error type
  return NextResponse.json(
    { error: ErrorMessages.INTERNAL_ERROR },
    { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
  );
}

/**
 * Wrapper for API route handlers with automatic error handling.
 *
 * @param handler - Route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```ts
 * import { withErrorHandler } from '@/lib/errors/api-error';
 *
 * export const GET = withErrorHandler(async (req: NextRequest) => {
 *   // ... your logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withErrorHandler<T extends NextResponse>(
  handler: () => Promise<T> | T
): () => Promise<T> {
  return async () => {
    try {
      return await handler();
    } catch (error) {
      return handleApiError(error) as T;
    }
  };
}

/**
 * Async wrapper for API route handlers with request parameter.
 *
 * @param handler - Route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```ts
 * import { withAsyncErrorHandler } from '@/lib/errors/api-error';
 *
 * export const POST = withAsyncErrorHandler(async (req: NextRequest) => {
 *   const body = await req.json();
 *   // ... your logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withAsyncErrorHandler<T extends NextResponse>(
  handler: (req: Request) => Promise<T> | T
): (req: Request) => Promise<T> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      return handleApiError(error) as T;
    }
  };
}

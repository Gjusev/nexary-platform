/**
 * API route wrappers with rate limiting and error handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RateLimiters } from './rate-limit';

/**
 * Gets the client IP address from the request headers.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}

/**
 * Creates a NextResponse with rate limit headers.
 */
export function rateLimitResponse(
  success: boolean,
  remaining: number,
  resetTime: number
): NextResponse {
  const headers = {
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
  };

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers }
    );
  }

  return new NextResponse(null, { headers });
}

/**
 * Rate limiting check for admin endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkAdminRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.adminApi);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

/**
 * Rate limiting check for general API endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkApiRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.api);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

/**
 * Rate limiting check for authentication endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkAuthRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.auth);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

/**
 * Rate limiting check for chat endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkChatRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.chat);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

/**
 * Rate limiting check for RAG endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkRagRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.rag);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

/**
 * Rate limiting check for document endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkDocumentsRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.documents);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

/**
 * Rate limiting check for team endpoints.
 * Returns null if allowed, or a NextResponse if rate limited.
 *
 * @param request - The incoming request
 * @returns NextResponse if rate limited, null if allowed
 */
export function checkTeamRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, RateLimiters.team);

  if (!result.success) {
    return rateLimitResponse(false, 0, result.resetTime);
  }

  return null;
}

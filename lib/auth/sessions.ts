/**
 * Session Management for §203 StGB Compliance
 *
 * Implements session timeout and concurrent session limits as required by German law.
 * - Maximum 30 minutes of inactivity (§203 StGB requirement)
 * - Maximum 3 concurrent sessions per user
 * - Automatic session cleanup
 */

import { redis } from '../redis';

// Session configuration constants
const SESSION_TIMEOUT_MINUTES = 30;
const MAX_CONCURRENT_SESSIONS = 3;
const SESSION_LAST_ACTIVITY_PREFIX = 'session:last_activity:';
const USER_SESSIONS_PREFIX = 'user:sessions:';

/**
 * Check if a session has timed out due to inactivity
 * §203 StGB requires maximum 30 minutes of inactivity
 */
export async function checkSessionTimeout(userId: string): Promise<{
  valid: boolean;
  remainingMinutes?: number;
}> {
  try {
    const key = `${SESSION_LAST_ACTIVITY_PREFIX}${userId}`;
    const lastActivity = await redis.get(key);

    if (!lastActivity) {
      // First activity or no previous record
      // Set the initial timestamp
      await redis.setex(key, SESSION_TIMEOUT_MINUTES * 60, Date.now().toString());
      return { valid: true };
    }

    const lastActivityTime = parseInt(lastActivity as string, 10);
    const currentTime = Date.now();
    const inactiveMilliseconds = currentTime - lastActivityTime;
    const inactiveMinutes = inactiveMilliseconds / (1000 * 60);

    // Check if session has exceeded the timeout
    if (inactiveMinutes >= SESSION_TIMEOUT_MINUTES) {
      // Session has timed out
      await invalidateSession(userId);
      return { valid: false };
    }

    // Calculate remaining time
    const remainingMinutes = Math.max(0, SESSION_TIMEOUT_MINUTES - inactiveMinutes);

    // Update the timestamp (sliding window)
    await redis.setex(key, SESSION_TIMEOUT_MINUTES * 60, currentTime.toString());

    return { valid: true, remainingMinutes };
  } catch (error) {
    console.error('[Sessions] Error checking session timeout:', error);
    // Fail open for better UX (don't block users on Redis errors)
    return { valid: true };
  }
}

/**
 * Update session activity timestamp
 * Should be called on user activity to extend session
 */
export async function updateSessionActivity(userId: string): Promise<void> {
  try {
    const key = `${SESSION_LAST_ACTIVITY_PREFIX}${userId}`;
    await redis.setex(key, SESSION_TIMEOUT_MINUTES * 60, Date.now().toString());
  } catch (error) {
    console.error('[Sessions] Error updating session activity:', error);
  }
}

/**
 * Invalidate (delete) a user's session
 */
export async function invalidateSession(userId: string): Promise<void> {
  try {
    const activityKey = `${SESSION_LAST_ACTIVITY_PREFIX}${userId}`;
    await redis.del(activityKey);

    // Also remove all session IDs for this user
    const sessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    await redis.del(sessionsKey);
  } catch (error) {
    console.error('[Sessions] Error invalidating session:', error);
  }
}

/**
 * Enforce concurrent session limit
 * §203 StGB requires preventing credential sharing
 */
export async function enforceConcurrentSessionLimit(
  userId: string,
  sessionId: string
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const key = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessions = await redis.smembers(key);

    if (sessions.length >= MAX_CONCURRENT_SESSIONS && !sessions.includes(sessionId)) {
      // Limit exceeded
      return {
        allowed: false,
        reason: `Maximum ${MAX_CONCURRENT_SESSIONS} concurrent sessions allowed`
      };
    }

    // Add new session
    await redis.sadd(key, sessionId);
    // Set TTL to match session timeout
    await redis.expire(key, SESSION_TIMEOUT_MINUTES * 60);

    return { allowed: true };
  } catch (error) {
    console.error('[Sessions] Error enforcing concurrent session limit:', error);
    // Fail open for better UX
    return { allowed: true };
  }
}

/**
 * Remove a specific session (e.g., user logs out)
 */
export async function removeSession(userId: string, sessionId: string): Promise<void> {
  try {
    const key = `${USER_SESSIONS_PREFIX}${userId}`;
    await redis.srem(key, sessionId);
  } catch (error) {
    console.error('[Sessions] Error removing session:', error);
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  try {
    const key = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessions = await redis.smembers(key);
    return sessions as string[];
  } catch (error) {
    console.error('[Sessions] Error getting user sessions:', error);
    return [];
  }
}

/**
 * Get session timeout warning time (5 minutes before timeout)
 */
export function getSessionWarningTime(): number {
  return SESSION_TIMEOUT_MINUTES - 5; // 5 minutes before timeout
}

/**
 * Get maximum session timeout in minutes
 */
export function getMaxSessionTimeout(): number {
  return SESSION_TIMEOUT_MINUTES;
}

/**
 * Get remaining session time in minutes
 */
export async function getRemainingSessionTime(userId: string): Promise<number> {
  try {
    const key = `${SESSION_LAST_ACTIVITY_PREFIX}${userId}`;
    const lastActivity = await redis.get(key);

    if (!lastActivity) {
      return SESSION_TIMEOUT_MINUTES;
    }

    const lastActivityTime = parseInt(lastActivity as string, 10);
    const currentTime = Date.now();
    const inactiveMinutes = (currentTime - lastActivityTime) / (1000 * 60);

    return Math.max(0, SESSION_TIMEOUT_MINUTES - inactiveMinutes);
  } catch (error) {
    console.error('[Sessions] Error getting remaining session time:', error);
    return SESSION_TIMEOUT_MINUTES;
  }
}

/**
 * Extend session by updating activity timestamp
 * Called when user interacts with the application
 */
export async function extendSession(userId: string): Promise<void> {
  await updateSessionActivity(userId);
}

/**
 * Check if session should show timeout warning
 * Returns true if less than 5 minutes remaining
 */
export async function shouldShowTimeoutWarning(userId: string): Promise<boolean> {
  const remainingTime = await getRemainingSessionTime(userId);
  return remainingTime <= 5 && remainingTime > 0;
}

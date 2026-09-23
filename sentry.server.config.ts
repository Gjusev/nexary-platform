/**
 * Sentry Server Configuration
 *
 * Initializes Sentry for server-side error tracking and performance monitoring.
 * Captures errors in API routes, server actions, and background jobs.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV;
const SENTRY_TRACES_SAMPLE_RATE = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,

  // Performance monitoring
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

  // Integrations
  integrations: [
    Sentry.httpIntegration({
      // Capture HTTP request headers
      breadcrumbs: true,
    }),
    Sentry.postgresIntegration(),
    Sentry.redisIntegration(),
  ],

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Filter out sensitive data from request headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
      delete event.request.headers['x-auth-token'];
    }

    // Filter out sensitive data from user data
    if (event.user) {
      delete event.user['email'];
      delete event.user['ip_address'];
    }

    // Add custom context
    event.contexts = {
      ...event.contexts,
      app: {
        name: 'Nexary',
        version: process.env.npm_package_version || '0.1.0',
      },
    };

    return event;
  },

  // Before send transaction for performance monitoring
  beforeSendTransaction(event) {
    // Don't send transactions in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },

  // Set custom tags for better filtering
  initialScope: {
    tags: {
      platform: 'server',
      runtime: 'nodejs',
      nodeVersion: process.version,
    },
  },
});

export { Sentry };

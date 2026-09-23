/**
 * Sentry Client Configuration
 *
 * Initializes Sentry for browser-side error tracking and performance monitoring.
 * Captures unhandled errors, unhandled promise rejections, and performance data.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV;
const SENTRY_TRACES_SAMPLE_RATE = parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1');

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,

  // Performance monitoring
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,

  // Session replay
  replaysSessionSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE || '0.1'),
  replaysOnErrorSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE || '1.0'),

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
    Sentry.captureConsoleIntegration({
      levels: ['error'],
    }),
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
    }

    // Filter out sensitive data from breadcrumbs
    event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => {
      if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        const filteredData = { ...breadcrumb.data };
        delete filteredData['authorization'];
        delete filteredData['token'];
        delete filteredData['password'];
        return { ...breadcrumb, data: filteredData };
      }
      return breadcrumb;
    });

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
      platform: 'web',
      runtime: 'browser',
    },
  },
});

export { Sentry };

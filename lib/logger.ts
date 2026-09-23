/**
 * Professional Logging Utility
 *
 * Replaces console.log/error with structured, production-ready logging.
 * Supports log levels, context tagging, and environment-aware output.
 *
 * @example
 * ```ts
 * import { logger } from '@/lib/logger';
 *
 * // Basic logging
 * logger.info('User logged in', { userId: '123' });
 *
 * // Error logging with context
 * logger.error('Database connection failed', {
 *   error: err.message,
 *   host: 'db.example.com'
 * });
 *
 * // Debug logging (only in development)
 * logger.debug('Processing request', { requestId: 'abc' });
 * ```
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: Date;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    // Set log level based on environment
    this.isDevelopment = process.env.NODE_ENV === 'development';

    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = envLevel ? LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO : LogLevel.INFO;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * Format log entry for output
   */
  private format(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timeStr = entry.timestamp.toISOString();

    if (entry.context && Object.keys(entry.context).length > 0) {
      return `[${timeStr}] ${levelName}: ${entry.message} ${JSON.stringify(entry.context)}`;
    }

    return `[${timeStr}] ${levelName}: ${entry.message}`;
  }

  /**
   * Output log to console
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.format(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          // eslint-disable-next-line no-console
          console.log(formatted);
        }
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.log(formatted);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(formatted);
        break;
    }
  }

  /**
   * Debug level logging - only in development
   */
  debug(message: string, context?: LogContext): void {
    this.output({
      level: LogLevel.DEBUG,
      message,
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.output({
      level: LogLevel.INFO,
      message,
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.output({
      level: LogLevel.WARN,
      message,
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext | Error): void {
    let errorContext: LogContext = {};

    if (context instanceof Error) {
      errorContext = {
        error: context.message,
        stack: this.isDevelopment ? context.stack : undefined,
        name: context.name,
      };
    } else if (context) {
      errorContext = context;
    }

    this.output({
      level: LogLevel.ERROR,
      message,
      context: errorContext,
      timestamp: new Date(),
    });
  }

  /**
   * Create a child logger with preset context
   */
  child(presetContext: LogContext): ChildLogger {
    return new ChildLogger(this, presetContext);
  }
}

/**
 * Child Logger with preset context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private presetContext: LogContext
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.presetContext, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.presetContext, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.presetContext, ...context });
  }

  error(message: string, context?: LogContext | Error): void {
    this.parent.error(message, { ...this.presetContext, ...(typeof context === 'object' && !(context instanceof Error) ? context : {}) });
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create domain-specific loggers
 */
export const createLogger = (domain: string) => {
  return logger.child({ domain });
};

/**
 * Pre-configured loggers for common domains
 */
export const loggers = {
  api: createLogger('api'),
  db: createLogger('database'),
  rag: createLogger('rag'),
  auth: createLogger('auth'),
  cache: createLogger('cache'),
  ai: createLogger('ai'),
  storage: createLogger('storage'),
  web: createLogger('web'),
} as const;

/**
 * Migration helper: Replace console.log with logger
 *
 * Usage:
 * 1. Import: `import { logger } from '@/lib/logger';`
 * 2. Replace `console.log('message', data)` with `logger.info('message', data)`
 * 3. Replace `console.error('error', err)` with `logger.error('error', err)`
 * 4. Replace `console.warn('warning')` with `logger.warn('warning')`
 */
export const console = {
  log: (...args: unknown[]) => logger.info(String(args[0]), args[1] as LogContext),
  warn: (...args: unknown[]) => logger.warn(String(args[0]), args[1] as LogContext),
  error: (...args: unknown[]) => logger.error(String(args[0]), args[1] as LogContext | Error),
  debug: (...args: unknown[]) => logger.debug(String(args[0]), args[1] as LogContext),
  info: (...args: unknown[]) => logger.info(String(args[0]), args[1] as LogContext),
};

/**
 * Export default logger for convenience
 */
export default logger;

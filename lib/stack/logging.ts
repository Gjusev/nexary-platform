export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  metadata?: Record<string, any>;
  userId?: string;
  teamId?: string;
  ip?: string;
}

class StackAuthLogger {
  private logLevel: LogLevel;
  private context: string;

  constructor(context: string = 'StackAuth', logLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.logLevel = logLevel;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>, userId?: string, teamId?: string, ip?: string) {
    if (level > this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      metadata,
      userId,
      teamId,
      ip,
    };

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      // Send to external logging service (e.g., Datadog, Logtail, etc.)
      this.sendToLoggingService(entry);
    } else {
      // Console logging for development
      }
  }

  private sendToLoggingService(entry: LogEntry) {
    // Implement external logging service integration
    // This could be Datadog, Logtail, CloudWatch, etc.
    try {
      // Example: fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) });
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }

  error(message: string, metadata?: Record<string, any>, userId?: string, teamId?: string, ip?: string) {
    this.log(LogLevel.ERROR, message, metadata, userId, teamId, ip);
  }

  warn(message: string, metadata?: Record<string, any>, userId?: string, teamId?: string, ip?: string) {
    this.log(LogLevel.WARN, message, metadata, userId, teamId, ip);
  }

  info(message: string, metadata?: Record<string, any>, userId?: string, teamId?: string, ip?: string) {
    this.log(LogLevel.INFO, message, metadata, userId, teamId, ip);
  }

  debug(message: string, metadata?: Record<string, any>, userId?: string, teamId?: string, ip?: string) {
    this.log(LogLevel.DEBUG, message, metadata, userId, teamId, ip);
  }

  // Specific auth events
  logAuthEvent(event: string, userId?: string, teamId?: string, ip?: string, metadata?: Record<string, any>) {
    this.info(`Auth event: ${event}`, metadata, userId, teamId, ip);
  }

  logRegistration(userId: string, email: string, teamId?: string, ip?: string) {
    this.info('User registered', { email }, userId, teamId, ip);
  }

  logLogin(userId: string, email: string, teamId?: string, ip?: string) {
    this.info('User logged in', { email }, userId, teamId, ip);
  }

  logLoginFailed(email: string, reason: string, ip?: string) {
    this.warn('Login failed', { email, reason }, undefined, undefined, ip);
  }

  logPasswordResetRequest(email: string, ip?: string) {
    this.info('Password reset requested', { email }, undefined, undefined, ip);
  }

  logPasswordResetCompleted(userId: string, ip?: string) {
    this.info('Password reset completed', {}, userId, undefined, ip);
  }

  logTeamInvitationSent(inviterId: string, email: string, teamId: string, role: string, ip?: string) {
    this.info('Team invitation sent', { email, role }, inviterId, teamId, ip);
  }

  logTeamInvitationAccepted(invitationId: string, userId: string, teamId: string, ip?: string) {
    this.info('Team invitation accepted', { invitationId }, userId, teamId, ip);
  }

  logTeamInvitationDeclined(invitationId: string, email: string, teamId: string, ip?: string) {
    this.info('Team invitation declined', { invitationId, email }, undefined, teamId, ip);
  }

  logError(error: Error, context?: string, userId?: string, teamId?: string, ip?: string) {
    this.error(
      `Error${context ? ` in ${context}` : ''}: ${error.message}`,
      { stack: error.stack },
      userId,
      teamId,
      ip
    );
  }
}

// Create singleton instances
export const authLogger = new StackAuthLogger('StackAuth');
export const teamLogger = new StackAuthLogger('TeamManagement');
export const invitationLogger = new StackAuthLogger('Invitations');
export const passwordResetLogger = new StackAuthLogger('PasswordReset');

// Export for use in other modules
export default StackAuthLogger;

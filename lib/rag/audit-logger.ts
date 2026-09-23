import { CryptoUtils } from './crypto-utils';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  private logs: AuditLogEntry[] = [];

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: CryptoUtils.generateUUID(),
      timestamp: new Date(),
      ...entry
    };

    // In production, you'd save to database
    this.logs.push(logEntry);
    
    // Also log to console for development
    console.log('AUDIT LOG:', JSON.stringify(logEntry, null, 2));

    // In production, you might also send to external logging service
    if (process.env.NODE_ENV === 'production') {
      // await this.sendToExternalLogger(logEntry);
    }
  }

  async logFileUpload(userId: string | undefined, fileName: string, fileSize: number, success: boolean, ipAddress: string, userAgent: string, errorMessage?: string): Promise<void> {
    await this.log({
      userId,
      action: 'FILE_UPLOAD',
      resource: 'bescheid-document',
      details: {
        fileName,
        fileSize,
        fileType: fileName.split('.').pop()
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  async logTextExtraction(userId: string | undefined, textLength: number, success: boolean, ipAddress: string, userAgent: string, errorMessage?: string): Promise<void> {
    await this.log({
      userId,
      action: 'TEXT_EXTRACTION',
      resource: 'ocr-service',
      details: {
        textLength,
        ocrProvider: 'mistral-ocr-microservice'
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  async logAIAnalysis(userId: string | undefined, analysisType: string, hasErrors: boolean, confidence: number, success: boolean, ipAddress: string, userAgent: string, errorMessage?: string): Promise<void> {
    await this.log({
      userId,
      action: 'AI_ANALYSIS',
      resource: 'kimi-ai-service',
      details: {
        analysisType,
        hasErrors,
        confidence,
        aiModel: 'kimi-k2-128k'
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  async logLawyerContact(userId: string | undefined, lawyerEmail: string, success: boolean, ipAddress: string, userAgent: string, errorMessage?: string): Promise<void> {
    await this.log({
      userId,
      action: 'LAWYER_CONTACT',
      resource: 'lawyer-referral',
      details: {
        lawyerEmail: await this.hashEmail(lawyerEmail)
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  private async hashEmail(email: string): Promise<string> {
    const hash = await CryptoUtils.hashData(email, 'SHA-256');
    return hash.substring(0, 16);
  }

  // Get recent logs (for admin dashboard)
  getRecentLogs(limit: number = 100): AuditLogEntry[] {
    return this.logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Get logs for specific user
  getUserLogs(userId: string, limit: number = 50): AuditLogEntry[] {
    return this.logs
      .filter(log => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

export const auditLogger = new AuditLogger();

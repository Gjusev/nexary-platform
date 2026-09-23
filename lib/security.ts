import { NextRequest } from 'next/server';

export interface SecurityCheck {
  suspicious: boolean;
  reason?: string;
}

export class SecurityService {
  getClientIP(request: NextRequest): string {
    // Get client IP from various headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    return forwarded?.split(',')[0]?.trim() || 
           realIP || 
           cfConnectingIP || 
           'unknown';
  }

  sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts and special characters
    return fileName
      .replace(/[<>:"|?*\x00-\x1F]/g, '_')
      .replace(/\.\./g, '_')
      .substring(0, 255);
  }

  detectSuspiciousContent(content: string): SecurityCheck {
    // Basic suspicious content detection
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /<script/i,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { suspicious: true, reason: 'Suspicious pattern detected' };
      }
    }

    return { suspicious: false };
  }
}

export const securityService = new SecurityService();

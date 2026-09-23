import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { RateLimiter, getClientIp } from '@/lib/rate-limit';
import { ValidationService } from '@/lib/validation';
import { securityService } from '@/lib/security';
import { auditLogger } from '@/lib/rag/audit-logger';
import { OCRService } from '@/lib/rag/ocr';

// Create rate limiter for OCR endpoint
const ocrRateLimiter = new RateLimiter({
  uniqueTokenPerInterval: 20,
  interval: 60000, // 1 minute
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = securityService.getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  let userId: string | undefined;

  try {
    // Rate limiting check
    const { success: isAllowed } = await ocrRateLimiter.check(clientIP, 20);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
        { status: 429 }
      );
    }

    // Authentication (optional but recommended)
    const authResult = await authService.authenticateRequest(request);
    if (authResult) {
      userId = authResult.userId;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      await auditLogger.logFileUpload(userId, 'unknown', 0, false, clientIP, userAgent, 'No file provided');
      return NextResponse.json(
        { error: 'Keine Datei gefunden' },
        { status: 400 }
      );
    }

    // Validate file
    if (!ValidationService.isValidFileType(file.type)) {
      await auditLogger.logFileUpload(userId, file.name, file.size, false, clientIP, userAgent, 'Invalid file type');
      return NextResponse.json(
        { error: 'Nicht unterstütztes Dateiformat. Erlaubt: PDF, JPG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    if (!ValidationService.isValidFileSize(file.size)) {
      await auditLogger.logFileUpload(userId, file.name, file.size, false, clientIP, userAgent, 'File too large');
      return NextResponse.json(
        { error: 'Datei zu groß. Maximum: 10MB' },
        { status: 400 }
      );
    }

    // Security check on filename
    const sanitizedFileName = securityService.sanitizeFileName(file.name);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Additional security: scan buffer for malicious content
    const bufferString = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
    const securityCheck = securityService.detectSuspiciousContent(bufferString);
    if (securityCheck.suspicious) {
      await auditLogger.logFileUpload(userId, sanitizedFileName, file.size, false, clientIP, userAgent, 'Suspicious content detected');
      return NextResponse.json(
        { error: 'Datei enthält verdächtige Inhalte' },
        { status: 400 }
      );
    }

    const ocrService = new OCRService();

    let extractedText: string;

    try {
      extractedText = await ocrService.extractText(buffer, file.type);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error';
      await auditLogger.logFileUpload(userId, sanitizedFileName, file.size, false, clientIP, userAgent, errorMessage);
      return NextResponse.json(
        { error: 'Textextraktion fehlgeschlagen', message: errorMessage },
        { status: 500 }
      );
    }

    // Sanitize extracted text
    const sanitizedText = ValidationService.sanitizeText(extractedText);

    // Log successful extraction
    await auditLogger.logTextExtraction(userId, sanitizedText.length, true, clientIP, userAgent);

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      text: sanitizedText,
      success: true,
      metadata: {
        fileName: sanitizedFileName,
        fileSize: file.size,
        textLength: sanitizedText.length,
        processingTime
      }
    });
  } catch (error) {
    console.error('Fehler bei der Textextraktion:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await auditLogger.logTextExtraction(userId, 0, false, clientIP, userAgent, errorMessage);

    return NextResponse.json(
      {
        error: 'Textextraktion fehlgeschlagen',
        message: 'Ein technischer Fehler ist aufgetreten. Bitte versuchen Sie es erneut.'
      },
      { status: 500 }
    );
  }
}

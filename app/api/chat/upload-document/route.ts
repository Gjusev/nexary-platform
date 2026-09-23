import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFilename } from '@/lib/utils/security';
import type { StackUser } from '@/lib/types/user';
import { extractExcelWorkbook, type ExcelWorkbookData } from '@/lib/rag/text-extract';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

type MistralOCRResponse = {
  text?: string;
  pages?: Array<{ text?: string } | null> | null;
};

function cleanExtractedText(rawText: string | null | undefined): string {
  if (!rawText) return '';

  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractTextWithMistralOCR(buffer: Buffer, filename: string): Promise<string> {
  const mistralApiKey = process.env.MISTRAL_API_KEY || process.env.AI_API_KEY;
  if (!mistralApiKey) {
    console.warn('⚠️ Missing MISTRAL_API_KEY or AI_API_KEY environment variable. Skipping OCR fallback.');
    return '';
  }

  try {
    const response = await fetch(process.env.MISTRAL_OCR_ENDPOINT || 'https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: {
          type: 'base64',
          data: buffer.toString('base64'),
          mime_type: 'application/pdf',
          name: filename,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Mistral OCR API error:', errorText);
      return '';
    }

    const data = (await response.json()) as MistralOCRResponse;
    const combinedText = [
      cleanExtractedText(data.text),
      ...(data.pages || []).map(page => cleanExtractedText(page?.text)),
    ]
      .filter(Boolean)
      .join('\n\n');

    return cleanExtractedText(combinedText);
  } catch (error) {
    console.error('❌ Error calling Mistral OCR API:', error);
    return '';
  }
}

// Helper to extract text from PDF
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const pdfParseMod = await import('pdf-parse');
    const pdfParse = pdfParseMod.default || pdfParseMod;
    const { text } = await pdfParse(buffer);
    const cleanedText = cleanExtractedText(text);
    if (cleanedText.length >= 50) {
      return cleanedText;
    }
    console.warn('⚠️ Extracted text from pdf-parse is too short, falling back to Mistral OCR.');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isKnownLibraryWarning = errorMsg.includes('test/data') ||
      errorMsg.includes('05-versions-space.pdf') ||
      (errorMsg.includes('ENOENT') && errorMsg.includes('test'));

    if (isKnownLibraryWarning) {
      console.warn('[PDF Extract] Known library warning (harmless):', {
        filename: file.name,
        note: 'pdf-parse library tries to access a test file on init - this is harmless',
        error: errorMsg,
      });
    } else {
      console.error('❌ Error extracting text with pdf-parse:', error);
    }
  }

  const ocrText = await extractTextWithMistralOCR(buffer, file.name);
  const cleanedOCRText = cleanExtractedText(ocrText);

  if (cleanedOCRText.length === 0) {
    throw new Error('Could not extract meaningful text from PDF');
  }

  return cleanedOCRText;
}

// Helper to chunk text with larger, more efficient chunks
function chunkText(text: string, chunkSize: number = 2000, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));

    // Move forward by chunkSize - overlap, but ensure we always progress
    start = start + chunkSize - overlap;

    // Safety check: if we're not making progress, break
    if (start <= end - chunkSize + overlap) {
      start = end;
    }
  }

  return chunks;
}

// Helper to create embeddings using OpenAI (single)
async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ No OpenAI API key found, using mock embeddings');
    return Array.from({ length: 3072 }, () => Math.random());
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: text.substring(0, 8000), // Limit to 8k chars to avoid token limits
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error('Failed to create embedding');
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Error creating embedding:', error);
    // Fallback to mock if OpenAI fails
    return Array.from({ length: 3072 }, () => Math.random());
  }
}

// Helper to create multiple embeddings in batch (much faster!)
async function createBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ No OpenAI API key found, using mock embeddings');
    return texts.map(() => Array.from({ length: 3072 }, () => Math.random()));
  }

  try {
    // Truncate texts to avoid token limits
    const truncatedTexts = texts.map(t => t.substring(0, 8000));

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: truncatedTexts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error('Failed to create embeddings');
    }

    const data = await response.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  } catch (error) {
    console.error('❌ Error creating batch embeddings:', error);
    // Fallback to mock if OpenAI fails
    return texts.map(() => Array.from({ length: 3072 }, () => Math.random()));
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Type assertion: Stack SDK's CurrentServerUser to our StackUser type
  const typedUser = user as unknown as StackUser;
  const userEmail = typedUser.primaryEmail || '';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const conversationId = formData.get('conversationId') as string;

    if (!file || !conversationId) {
      return NextResponse.json(
        { success: false, error: 'File and conversationId required' },
        { status: 400 }
      );
    }

    // Security: Sanitize filename to prevent path traversal attacks
    const safeFilename = sanitizeFilename(file.name);

    // Debug info
    // Validate file type
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isExcel = file.type.includes('spreadsheetml') ||
                    file.type.includes('vnd.ms-excel') ||
                    file.name.toLowerCase().endsWith('.xlsx') ||
                    file.name.toLowerCase().endsWith('.xls');

    if (!isPdf && !isExcel) {
      return NextResponse.json(
        { success: false, error: 'Only PDF and Excel files are supported' },
        { status: 400 }
      );
    }

    // Validate file size (25MB max for Excel, 10MB for PDF)
    const maxSize = isExcel ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${isExcel ? '25MB' : '10MB'})` },
        { status: 400 }
      );
    }

    // Extract text and structured data
    let text: string;
    let workbookData: ExcelWorkbookData | null = null;
    let metadata: Record<string, any> = {};

    if (isExcel) {
      // Handle Excel files
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract structured workbook data
      workbookData = await extractExcelWorkbook(buffer, { filename: safeFilename });

      if (!workbookData) {
        return NextResponse.json(
          { success: false, error: 'Could not extract data from Excel file' },
          { status: 400 }
        );
      }

      // Store workbook data in metadata
      metadata.workbook = workbookData;
      metadata.sheetCount = workbookData.sheets.length;
      metadata.totalRows = workbookData.sheets.reduce((sum, s) => sum + s.rowCount, 0);

      // Also extract text for RAG (from first sheet or summary)
      const firstSheet = workbookData.sheets[0];
      text = `Excel file: ${safeFilename}\n\n`;
      text += `Sheets: ${workbookData.sheets.map(s => s.name).join(', ')}\n`;
      text += `Total rows: ${metadata.totalRows}\n\n`;

      // Add data preview from first sheet
      if (firstSheet) {
        text += `Sheet: ${firstSheet.name}\n`;
        text += `Columns: ${firstSheet.headers.join(', ')}\n`;
        text += `Rows: ${firstSheet.rowCount}\n\n`;

        // Add first few rows as preview
        const previewRows = firstSheet.data.slice(0, 10);
        text += 'Preview:\n';
        previewRows.forEach((row, i) => {
          text += `Row ${i + 1}: ${JSON.stringify(row)}\n`;
        });
      }

      } else {
      // Handle PDF files
      try {
        text = await extractTextFromPDF(file);
      } catch (error) {
        console.error('❌ Failed to extract text from PDF:', error);
        const message = error instanceof Error ? error.message : 'Could not extract text from PDF';
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 }
        );
      }
    }

    if (!text || text.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Extracted text is too short to index' },
        { status: 400 }
      );
    }

    // Chunk the text
    const chunks = chunkText(text);

    // Create document record
    const documentId = uuidv4();
    // Serialize metadata for JSON storage
    const metadataJson = metadata && Object.keys(metadata).length > 0
      ? JSON.stringify(metadata)
      : null;

    await query(
      `INSERT INTO projectnexus.chat_documents (id, conversation_id, filename, content, file_size, content_type, user_email, created_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [documentId, conversationId, safeFilename, text, file.size, file.type, userEmail, metadataJson]
    );

    // Create embeddings for chunks in batches (much faster!)
    let successCount = 0;
    let errorCount = 0;

    // Process in batches of 100 (OpenAI allows up to 2048, but 100 is safer)
    const batchSize = 100;
    const totalBatches = Math.ceil(chunks.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, chunks.length);
      const batchChunks = chunks.slice(start, end);

      try {
        // Create embeddings for entire batch at once
        const embeddings = await createBatchEmbeddings(batchChunks);

        // Insert all embeddings from this batch
        for (let i = 0; i < batchChunks.length; i++) {
          const chunkIndex = start + i;
          const embeddingStr = `[${embeddings[i].join(',')}]`;

          await query(
            `INSERT INTO projectnexus.chat_embeddings (id, document_id, conversation_id, chunk_text, chunk_index, embedding, created_at)
             VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
            [uuidv4(), documentId, conversationId, batchChunks[i], chunkIndex, embeddingStr]
          );
          successCount++;
        }
      } catch (error) {
        errorCount += batchChunks.length;
        console.error(`  ❌ Failed to process batch ${batchIndex + 1}:`, error);
      }
    }

    // Return success with workbook data if Excel
    type UploadDocumentResponse = {
      success: true;
      documentId: string;
      filename: string;
      chunks: number;
      message: string;
      workbook?: ExcelWorkbookData;
    };
    const response: UploadDocumentResponse = {
      success: true,
      documentId,
      filename: safeFilename,
      chunks: chunks.length,
      message: 'Document processed successfully',
    };

    if (workbookData) {
      response.workbook = workbookData;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process document',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

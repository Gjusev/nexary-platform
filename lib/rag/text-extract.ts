// Lightweight, safe text extraction for PDF/DOCX/XLSX/PPTX using pure JS libraries.
// Security notes:
// - No external binaries are executed.
// - We impose a max buffer size to mitigate memory pressure.
// - Only extracts text; ignores macros, scripts and embedded content.


const MAX_BUFFER_BYTES = Number(process.env.TEXT_EXTRACT_MAX_BYTES || 25 * 1024 * 1024); // 25MB

function looksLikePdf(contentType?: string, filename?: string) {
  const ct = String(contentType || '').toLowerCase();
  const fn = String(filename || '').toLowerCase();
  return ct.includes('pdf') || /\.pdf$/i.test(fn);
}

function looksLikeDocx(contentType?: string, filename?: string) {
  const ct = String(contentType || '').toLowerCase();
  const fn = String(filename || '').toLowerCase();
  return (
    ct.includes('vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    /\.(docx)$/i.test(fn)
  );
}

function looksLikeExcel(contentType?: string, filename?: string) {
  const ct = String(contentType || '').toLowerCase();
  const fn = String(filename || '').toLowerCase();
  return (
    ct.includes('vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
    ct.includes('vnd.ms-excel') ||
    /\.(xlsx|xls)$/i.test(fn)
  );
}

function looksLikePowerPoint(contentType?: string, filename?: string) {
  const ct = String(contentType || '').toLowerCase();
  const fn = String(filename || '').toLowerCase();
  return (
    ct.includes('vnd.openxmlformats-officedocument.presentationml.presentation') ||
    ct.includes('vnd.ms-powerpoint') ||
    /\.(pptx|ppt)$/i.test(fn)
  );
}

type PdfTextItem = { str?: string };

type PdfParseResult = {
  text?: string;
  numpages?: number;
  info?: unknown;
  metadata?: unknown;
};

/**
 * Excel workbook data structure for UI display
 */
export type ExcelWorkbookData = {
  sheets: ExcelSheetData[];
};

/**
 * Single sheet data from Excel workbook
 */
export type ExcelSheetData = {
  name: string;
  headers: string[];
  data: Array<Record<string, any>>;
  rowCount: number;
  columnCount: number;
};

/**
 * Cell value type
 */
export type ExcelCellValue = string | number | boolean | Date | null;

function cleanExtractedText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length > 0 ? normalized : null;
}

async function renderPdfPage(pageData: any): Promise<string> {
  const textContent = await pageData.getTextContent();
  const items = (textContent?.items as PdfTextItem[]) || [];
  const strings = items
    .map((item) => (typeof item.str === 'string' ? item.str : ''))
    .filter(Boolean);
  return strings.join(' ').replace(/\s+/g, ' ').trim();
}

function buildPdfParseOptions() {
  const maxPagesEnv = Number(process.env.PDF_PARSE_MAX_PAGES || 0);
  return {
    max: Number.isFinite(maxPagesEnv) && maxPagesEnv > 0 ? maxPagesEnv : 0,
    pagerender: renderPdfPage,
  };
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  opts: { contentType?: string; filename?: string }
): Promise<string | null> {
  try {
    if (!buffer || buffer.length === 0) return null;
    if (buffer.length > MAX_BUFFER_BYTES) {
      return null; // too large to parse safely
    }

    if (looksLikePdf(opts.contentType, opts.filename)) {
      let extractedText: string | null = null;
      let pdfParseError: Error | null = null;
      let pageCount = 0;

      // Intentar extracción directa primero
      try {
        const pdfParseMod: any = await import('pdf-parse');
        const pdfParse = pdfParseMod.default || pdfParseMod;
        const result = (await pdfParse(buffer, buildPdfParseOptions())) as PdfParseResult;
        pageCount = result?.numpages ?? 0;
        const cleaned = cleanExtractedText(result?.text);

        if (cleaned) {
          console.log('[RAG extract] ✅ PDF text extracted successfully', {
            filename: opts.filename,
            pages: pageCount,
            textLength: cleaned.length,
            sizeKB: Math.round(buffer.length / 1024)
          });
          return cleaned;
        }
        
        // PDF parseado pero sin texto extraíble
        console.warn('[RAG extract] ⚠️ PDF parsed but no extractable text found', {
          filename: opts.filename,
          pages: pageCount,
          sizeKB: Math.round(buffer.length / 1024),
          diagnosis: pageCount > 0 
            ? 'PDF probablemente es escaneado (solo imágenes) o está protegido. Intentando OCR...'
            : 'PDF puede estar corrupto o vacío.'
        });
      } catch (err) {
        pdfParseError = err instanceof Error ? err : new Error(String(err));
        const errorMsg = pdfParseError.message;
        
        // Filtrar warnings conocidos de pdf-parse sobre archivos de prueba
        const isKnownLibraryWarning = errorMsg.includes('test/data') || 
                                      errorMsg.includes('05-versions-space.pdf') ||
                                      (errorMsg.includes('ENOENT') && errorMsg.includes('test'));
        
        if (isKnownLibraryWarning) {
          console.warn('[RAG extract] Known pdf-parse library warning (harmless)', {
            filename: opts.filename,
            note: 'pdf-parse library tries to access a test file on init - this is harmless'
          });
        } else {
          console.warn('[RAG extract] ⚠️ pdf-parse failed, will try OCR', {
            filename: opts.filename,
            error: errorMsg,
          });
        }
      }

      // Si no hay texto extraído, intentar OCR
      if (!extractedText) {
        console.warn('[RAG extract] 🔍 Attempting OCR for PDF', {
          filename: opts.filename,
          sizeKB: Math.round(buffer.length / 1024),
          hadParseError: !!pdfParseError
        });

        try {
          const { OCRService } = await import('@/lib/rag/ocr');
          const ocrService = new OCRService();
          const ocrText = await ocrService.extractText(
            buffer, 
            opts.contentType || 'application/pdf',
            opts.filename
          );
          
          if (ocrText) {
            const cleanedOcrText = cleanExtractedText(ocrText);
            if (cleanedOcrText) {
              console.log('[RAG extract] ✅ OCR extracted text successfully', {
                filename: opts.filename,
                textLength: cleanedOcrText.length
              });
              return cleanedOcrText;
            }
          }
          
          console.warn('[RAG extract] ⚠️ OCR returned no text', {
            filename: opts.filename
          });
        } catch (ocrError) {
          console.error('[RAG extract] ❌ OCR failed', {
            filename: opts.filename,
            error: ocrError instanceof Error ? ocrError.message : 'Unknown OCR error'
          });
        }
      }
      
      console.warn('[RAG extract] ❌ No text could be extracted (neither direct parsing nor OCR)', {
        filename: opts.filename
      });
      return null;
    }

    if (looksLikeDocx(opts.contentType, opts.filename)) {
      try {
        const mammoth: any = await import('mammoth');
        const out = await mammoth.extractRawText({ buffer });
        const cleaned = cleanExtractedText(out?.value);
        if (cleaned) {
          return cleaned;
        }
        return null;
      } catch (err) {
        console.warn('[RAG extract] docx parse failed', {
          filename: opts.filename,
          error: err instanceof Error ? err.message : 'unknown',
        });
        return null;
      }
    }

    if (looksLikeExcel(opts.contentType, opts.filename)) {
      try {
        // Use xlsx library for Excel files
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        let allText = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          // Convert sheet to CSV-like text
          const sheetText = XLSX.utils.sheet_to_txt(sheet, { FS: '\t', RS: '\n' });
          if (sheetText) {
            allText += `\n\n=== Sheet: ${sheetName} ===\n\n${sheetText}`;
          }
        }
        
        const cleaned = cleanExtractedText(allText);
        if (cleaned) {
          return cleaned;
        }
        return null;
      } catch (err) {
        console.warn('[RAG extract] Excel parse failed', {
          filename: opts.filename,
          error: err instanceof Error ? err.message : 'unknown',
        });
        return null;
      }
    }

    if (looksLikePowerPoint(opts.contentType, opts.filename)) {
      try {
        // PowerPoint files are ZIP archives
        const AdmZip = await import('adm-zip');
        const zip = new AdmZip.default(buffer);
        const zipEntries = zip.getEntries();
        
        let allText = '';
        let slideCount = 0;
        
        // Extract text from slides
        for (const entry of zipEntries) {
          if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
            const xmlContent = entry.getData().toString('utf8');
            // Extract text from <a:t> tags (text runs in PowerPoint XML)
            const textMatches = xmlContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
            const slideText = textMatches
              .map(match => {
                const content = match.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '');
                return content;
              })
              .join(' ');
            
            if (slideText.trim()) {
              slideCount++;
              allText += `\n\n=== Slide ${slideCount} ===\n\n${slideText}`;
            }
          }
        }
        
        const cleaned = cleanExtractedText(allText);
        if (cleaned) {
          return cleaned;
        }
        return null;
      } catch (err) {
        console.warn('[RAG extract] PowerPoint parse failed', {
          filename: opts.filename,
          error: err instanceof Error ? err.message : 'unknown',
        });
        return null;
      }
    }

    return null;
  } catch (error) {
    console.warn('[RAG extract] unexpected failure', {
      filename: opts.filename,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/**
 * Extract structured data from Excel workbook for UI display.
 * Preserves data types (numbers, dates, booleans) and column headers.
 *
 * @param buffer - Excel file buffer
 * @param opts - Options including filename and max rows
 * @returns Structured workbook data with sheets, headers, and data rows
 */
export async function extractExcelWorkbook(
  buffer: Buffer,
  opts?: { filename?: string; maxRows?: number }
): Promise<ExcelWorkbookData | null> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    const sheets: ExcelSheetData[] = [];
    const maxRows = opts?.maxRows || 10000; // Limit to prevent memory issues

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // Convert to array of arrays (raw values with type preservation)
      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1, // Use array of arrays format
        defval: null, // Default value for empty cells
        dateNF: 'yyyy-mm-dd', // Date format
      }) as any[][];

      if (!rawRows || rawRows.length === 0) {
        continue;
      }

      // First row contains headers
      const headers = rawRows[0].map((h: any) =>
        h !== null && h !== undefined ? String(h) : `Column${rawRows[0].indexOf(h) + 1}`
      );

      // Convert remaining rows to objects
      const data: Array<Record<string, any>> = [];
      const rowsToProcess = Math.min(rawRows.length - 1, maxRows);

      for (let i = 1; i < rowsToProcess + 1; i++) {
        const row = rawRows[i];
        if (!row) continue;

        const rowData: Record<string, any> = {};
        headers.forEach((header, colIndex) => {
          rowData[header] = row[colIndex] !== undefined ? row[colIndex] : null;
        });

        // Skip completely empty rows
        if (Object.values(rowData).some((v) => v !== null && v !== undefined && v !== '')) {
          data.push(rowData);
        }
      }

      sheets.push({
        name: sheetName,
        headers,
        data,
        rowCount: data.length,
        columnCount: headers.length,
      });
    }

    console.debug('[Excel Workbook] Extraction complete', {
      sheetsCount: sheets.length,
      totalRows: sheets.reduce((sum, s) => sum + s.rowCount, 0),
    });

    if (sheets.length === 0) {
      return null;
    }

    return { sheets };
  } catch (error) {
    console.warn('[RAG extract] Excel workbook extraction failed', {
      filename: opts?.filename,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/**
 * Adaptive Chunking by Document Type
 *
 * Implements different chunking strategies based on document type:
 * - PDF: Semantic paragraph-aware chunking
 * - Code: Function/class-level chunking
 * - Markdown: Header-based chunking
 * - Tables: Row-wise chunking
 * - Legal: Clause-based chunking
 * - Medical: Section-based chunking
 */

export interface ChunkStrategy {
  name: string;
  maxChunkSize: number;
  overlap: number;
  separator: string | RegExp;
  preserveStructure: boolean;
  metadataExtraction: (text: string, chunk: string) => Record<string, any>;
}

export interface ChunkResult {
  text: string;
  index: number;
  metadata: Record<string, any>;
  strategy: string;
}

// ============================================================================
// Document Type Detection
// ============================================================================

/**
 * Detect document type from content or filename
 */
export function detectDocumentType(
  content: string,
  filename?: string
): 'pdf' | 'code' | 'markdown' | 'html' | 'table' | 'legal' | 'medical' | 'general' {
  const lowerContent = content.toLowerCase();
  const lowerFilename = filename?.toLowerCase() || '';

  // Code detection
  if (
    lowerFilename.match(/\.(js|ts|py|java|cpp|c|go|rs|rb|php|cs|swift|kt|scala)$/i) ||
    lowerContent.includes('function ') ||
    lowerContent.includes('class ') ||
    lowerContent.includes('def ') ||
    lowerContent.includes('public ') ||
    lowerContent.includes('import ')
  ) {
    return 'code';
  }

  // Markdown detection
  if (
    lowerFilename.endsWith('.md') ||
    lowerContent.match(/^#{1,6}\s+/m) ||
    lowerContent.includes('```')
  ) {
    return 'markdown';
  }

  // HTML detection
  if (
    lowerFilename.endsWith('.html') ||
    lowerContent.match(/<html|<body|<div|<p>/i)
  ) {
    return 'html';
  }

  // Table detection
  if (lowerContent.match(/^\|.*\|$/m) && lowerContent.split('\n').filter(line => line.includes('|')).length > 5) {
    return 'table';
  }

  // Legal document detection
  if (
    lowerFilename.match(/\b(contract|agreement|legal|terms|conditions)\b/i) ||
    lowerContent.match(/\b(whereas|therefore|hereby|herein|clause|article)\b/i)
  ) {
    return 'legal';
  }

  // Medical document detection
  if (
    lowerFilename.match(/\b(medical|clinical|patient|diagnosis|treatment|prescription)\b/i) ||
    lowerContent.match(/\b(diagnosis|symptom|treatment|medication|dosage|mg|ml)\b/i)
  ) {
    return 'medical';
  }

  // PDF (default for unknown text files)
  if (lowerFilename.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'general';
}

// ============================================================================
// Chunking Strategies
// ============================================================================

/**
 * Get chunking strategy for document type
 */
export function getChunkStrategy(docType: ReturnType<typeof detectDocumentType>): ChunkStrategy {
  const strategies: Record<typeof docType, ChunkStrategy> = {
    pdf: {
      name: 'semantic-paragraph',
      maxChunkSize: 1000,
      overlap: 200,
      separator: /\n\s*\n/,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => ({
        type: 'pdf',
        paragraphCount: chunk.split(/\n\s*\n/).length,
        sentenceCount: chunk.split(/[.!?]+/).length,
      }),
    },

    code: {
      name: 'function-level',
      maxChunkSize: 1500,
      overlap: 100,
      separator: /(?:\n\s*\/\/.*|\n\s*#.*|\n\s*\/\*[\s\S]*?\*\/)\s*\n/,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => {
        const functions = chunk.match(/(?:function|def|class|const|let|var)\s+\w+/g) || [];
        return {
          type: 'code',
          functions: functions.map(f => f.replace(/^(function|def|class|const|let|var)\s+/, '')),
          language: detectCodeLanguage(text),
        };
      },
    },

    markdown: {
      name: 'header-based',
      maxChunkSize: 1200,
      overlap: 150,
      separator: /^(#{1,6}\s+.*)\n/m,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => {
        const headers = chunk.match(/^#{1,6}\s+(.*)$/gm) || [];
        const firstHeaderMatch = headers[0]?.match(/^#+/);
        return {
          type: 'markdown',
          headers: headers.map(h => h.replace(/^#+\s+/, '')),
          level: firstHeaderMatch ? firstHeaderMatch[0].length : 0,
        };
      },
    },

    html: {
      name: 'tag-based',
      maxChunkSize: 1000,
      overlap: 200,
      separator: /<(h[1-6]|p|div|section|article)[^>]*>/i,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => {
        const tags = chunk.match(/<(h[1-6]|p|div|section|article)/gi) || [];
        const uniqueTags = Array.from(new Set(tags.map(t => t.replace(/[<>]/g, ''))));
        return {
          type: 'html',
          tags: uniqueTags,
          hasTables: /<table/i.test(chunk),
        };
      },
    },

    table: {
      name: 'row-wise',
      maxChunkSize: 500,
      overlap: 50,
      separator: /\n/,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => ({
        type: 'table',
        rows: chunk.split('\n').length,
        columns: chunk.split('|').length - 1,
      }),
    },

    legal: {
      name: 'clause-based',
      maxChunkSize: 800,
      overlap: 100,
      separator: /(?=\b(?:Section|Article|Clause|Paragraph)\s+\d+\.)/i,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => {
        const clauseMatch = chunk.match(/(Section|Article|Clause|Paragraph)\s+\d+/i);
        return {
          type: 'legal',
          clause: clauseMatch ? clauseMatch[0] : 'preamble',
          wordCount: chunk.split(/\s+/).length,
        };
      },
    },

    medical: {
      name: 'section-based',
      maxChunkSize: 900,
      overlap: 150,
      separator: /(?=\b(?:Chief Complaint|History|Examination|Diagnosis|Treatment|Medication|Follow-up)\b:\s*)/i,
      preserveStructure: true,
      metadataExtraction: (text, chunk) => {
        const sectionMatch = chunk.match(/(Chief Complaint|History|Examination|Diagnosis|Treatment|Medication|Follow-up):\s*/i);
        return {
          type: 'medical',
          section: sectionMatch ? sectionMatch[1] : 'general',
          hasDosage: /\b\d+\s*(mg|ml|mcg|tablet|capsule)\b/i.test(chunk),
        };
      },
    },

    general: {
      name: 'paragraph',
      maxChunkSize: 1000,
      overlap: 200,
      separator: /\n\s*\n/,
      preserveStructure: false,
      metadataExtraction: () => ({ type: 'general' }),
    },
  };

  return strategies[docType];
}

/**
 * Detect programming language from code content
 */
function detectCodeLanguage(content: string): string {
  const patterns: Record<string, RegExp> = {
    javascript: /(?:function\s+\w+|const\s+\w+\s*=|=>|import\s+.*from|require\()/,
    typescript: /(?:interface\s+\w+|type\s+\w+\s*=|: string|: number|: boolean)/,
    python: /(?:def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import)/,
    java: /(?:public\s+class|private\s+|protected\s+|System\.out\.println)/,
    cpp: /(?:#include|cout|cin|std::|\/\/.*|\/\*[\s\S]*?\*\/)/,
    go: /(?:func\s+\w+|package\s+\w+|import\s*\()/,
    rust: /(?:fn\s+\w+|let\s+mut|impl\s+\w+|use\s+\w+::)/,
    php: /(?:\$\w+|function\s+\w+\s*\(|->|=>)/,
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) {
      return lang;
    }
  }

  return 'unknown';
}

// ============================================================================
// Adaptive Chunking Implementation
// ============================================================================

/**
 * Chunk document using adaptive strategy
 */
export function adaptiveChunk(
  content: string,
  filename?: string,
  options?: {
    forceStrategy?: string;
    customMaxSize?: number;
    customOverlap?: number;
  }
): ChunkResult[] {
  // Detect document type
  const docType = options?.forceStrategy
    ? (options.forceStrategy as any)
    : detectDocumentType(content, filename);

  // Get appropriate strategy
  const strategy = getChunkStrategy(docType);

  // Override with custom options if provided
  const maxChunkSize = options?.customMaxSize || strategy.maxChunkSize;
  const overlap = options?.customOverlap || strategy.overlap;

  // Split content into chunks
  const chunks = splitContent(content, strategy.separator, maxChunkSize, overlap);

  // Add metadata to each chunk
  const results: ChunkResult[] = chunks.map((chunk, index) => ({
    text: chunk,
    index,
    metadata: {
      ...strategy.metadataExtraction(content, chunk),
      filename,
      chunkSize: chunk.length,
      startIndex: content.indexOf(chunk),
      endIndex: content.indexOf(chunk) + chunk.length,
    },
    strategy: strategy.name,
  }));

  return results;
}

/**
 * Split content into chunks using separator and size limits
 */
function splitContent(
  content: string,
  separator: string | RegExp,
  maxChunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];

  // Split by separator first
  const sections = content.split(separator);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;

    // If adding this section exceeds max size
    if (currentChunk.length + trimmedSection.length > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      chunkIndex++;

      // Start new chunk with overlap from previous
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + trimmedSection;
      } else {
        currentChunk = trimmedSection;
      }
    } else {
      // Add section to current chunk
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + trimmedSection;
      } else {
        currentChunk = trimmedSection;
      }
    }

    // If single section exceeds max size, split it
    if (currentChunk.length > maxChunkSize) {
      const subChunks = splitLongSection(currentChunk, maxChunkSize, overlap);
      chunks.push(...subChunks.slice(0, -1));
      currentChunk = subChunks[subChunks.length - 1];
    }
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Split a section that's too long
 */
function splitLongSection(
  section: string,
  maxChunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];

  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Add overlap
      if (overlap > 0) {
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================================
// Specialized Chunkers
// ============================================================================

/**
 * Chunk code by function/class
 */
export function chunkCodeByFunction(content: string): ChunkResult[] {
  const chunks: ChunkResult[] = [];

  // Match function/class definitions
  const patterns = [
    /(?:function|const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function\s*\([^)]*\))/g,
    /(?:class|interface|type)\s+(\w+)/g,
    /def\s+(\w+)\s*\(/g,
    /public\s+(?:static\s+)?(?:void|async\s+Task|Task)\s+(\w+)/g,
  ];

  let currentIndex = 0;
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const funcName = match[1] || match[0];
        const startLine = index;
        let endLine = index + 1;

        // Find end of function (next function or empty lines)
        while (endLine < lines.length && !lines[endLine].match(pattern) && lines[endLine].trim() !== '') {
          endLine++;
        }

        const chunk = lines.slice(startLine, endLine).join('\n');
        if (chunk.length > 0) {
          chunks.push({
            text: chunk,
            index: currentIndex++,
            metadata: {
              type: 'code',
              functionName: funcName,
              startLine,
              endLine,
              language: detectCodeLanguage(content),
            },
            strategy: 'function-level',
          });
        }
      }
    }
  });

  return chunks;
}

/**
 * Chunk markdown by headers
 */
export function chunkMarkdownByHeaders(content: string): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const lines = content.split('\n');

  let currentChunk: string[] = [];
  let currentHeaders: Array<{ level: number; title: string }> = [];
  let chunkIndex = 0;

  lines.forEach(line => {
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headerMatch) {
      // Save previous chunk if exists
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.join('\n'),
          index: chunkIndex++,
          metadata: {
            type: 'markdown',
            headers: currentHeaders.map(h => h.title),
            level: currentHeaders.length > 0 ? currentHeaders[0].level : 0,
          },
          strategy: 'header-based',
        });
      }

      // Start new chunk
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      currentHeaders = [{ level, title }];
      currentChunk = [line];
    } else {
      currentChunk.push(line);
    }
  });

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join('\n'),
      index: chunkIndex,
      metadata: {
        type: 'markdown',
        headers: currentHeaders,
        level: currentHeaders.length > 0 ? currentHeaders[0].level : 0,
      },
      strategy: 'header-based',
    });
  }

  return chunks;
}

/**
 * Chunk tables by rows
 */
export function chunkTableByRows(content: string, maxRows: number = 50): ChunkResult[] {
  const lines = content.split('\n').filter(line => line.trim());
  const chunks: ChunkResult[] = [];

  // Skip separator lines
  const dataRows = lines.filter(line => !line.match(/^\|[\s\-:]+\|$/));

  // Header row
  const headerRow = dataRows[0] || '';

  let currentChunk: string[] = [headerRow];
  let chunkIndex = 0;

  for (let i = 1; i < dataRows.length; i++) {
    currentChunk.push(dataRows[i]);

    if (currentChunk.length >= maxRows) {
      chunks.push({
        text: currentChunk.join('\n'),
        index: chunkIndex++,
        metadata: {
          type: 'table',
          rowCount: currentChunk.length,
          columnCount: headerRow.split('|').length - 1,
          startRow: i - currentChunk.length + 2,
          endRow: i + 1,
        },
        strategy: 'row-wise',
      });

      currentChunk = [headerRow];
    }
  }

  // Add remaining rows
  if (currentChunk.length > 1) {
    chunks.push({
      text: currentChunk.join('\n'),
      index: chunkIndex,
      metadata: {
        type: 'table',
        rowCount: currentChunk.length,
        columnCount: headerRow.split('|').length - 1,
      },
      strategy: 'row-wise',
    });
  }

  return chunks;
}

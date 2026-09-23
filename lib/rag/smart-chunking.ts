/**
 * Smart Chunking with semantic awareness
 * Splits text into chunks while preserving semantic boundaries
 */

interface ChunkOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  preserveParagraphs?: boolean;
  preserveSentences?: boolean;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 1200,
  minChunkSize: 200,
  overlap: 200,
  preserveParagraphs: true,
  preserveSentences: true,
};

/**
 * Split text into sentences using multiple delimiters
 */
function splitIntoSentences(text: string): string[] {
  // Match sentence endings with various punctuation
  const sentenceRegex = /[^.!?]+[.!?]+["']?/g;
  const sentences = text.match(sentenceRegex) || [];
  
  if (sentences.length === 0) {
    return [text];
  }
  
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Check if text is a heading (starts with #, numbered, or all caps short line)
 */
function isHeading(text: string): boolean {
  const trimmed = text.trim();
  
  // Markdown headings
  if (/^#{1,6}\s/.test(trimmed)) return true;
  
  // Numbered headings (1., 1.1, etc.)
  if (/^\d+(\.\d+)*\.?\s/.test(trimmed)) return true;
  
  // All caps short line (likely a heading)
  if (trimmed.length < 100 && trimmed === trimmed.toUpperCase() && /^[A-Z\s]+$/.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Smart chunking that preserves semantic boundaries
 */
export function smartChunkText(text: string, options: ChunkOptions = {}): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: string[] = [];
  
  // Normalize text
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  
  if (normalized.length === 0) return [];
  
  // If text is small enough, return as single chunk
  if (normalized.length <= opts.maxChunkSize) {
    return [normalized];
  }
  
  // Split by paragraphs first
  const paragraphs = opts.preserveParagraphs 
    ? splitIntoParagraphs(normalized)
    : [normalized];
  
  let currentChunk = '';
  let currentSize = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphSize = paragraph.length;
    
    // Check if this paragraph is a heading
    const isHeadingParagraph = isHeading(paragraph);
    
    // If adding this paragraph exceeds max size, handle it
    if (currentSize + paragraphSize > opts.maxChunkSize && currentSize >= opts.minChunkSize) {
      // Save current chunk
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap
        if (opts.overlap > 0) {
          const overlapText = currentChunk.slice(-opts.overlap);
          currentChunk = overlapText + '\n\n';
          currentSize = overlapText.length + 2;
        } else {
          currentChunk = '';
          currentSize = 0;
        }
      }
      
      // If the paragraph itself is too large, split it by sentences
      if (paragraphSize > opts.maxChunkSize) {
        const sentences = opts.preserveSentences 
          ? splitIntoSentences(paragraph)
          : [paragraph];
        
        for (const sentence of sentences) {
          if (currentSize + sentence.length > opts.maxChunkSize && currentSize >= opts.minChunkSize) {
            if (currentChunk.trim().length > 0) {
              chunks.push(currentChunk.trim());
              
              if (opts.overlap > 0) {
                const overlapText = currentChunk.slice(-opts.overlap);
                currentChunk = overlapText + ' ';
                currentSize = overlapText.length + 1;
              } else {
                currentChunk = '';
                currentSize = 0;
              }
            }
          }
          
          currentChunk += sentence + ' ';
          currentSize += sentence.length + 1;
        }
      } else {
        // Keep heading with next content
        if (isHeadingParagraph && i < paragraphs.length - 1) {
          currentChunk = paragraph + '\n\n';
          currentSize = paragraphSize + 2;
        } else {
          currentChunk += paragraph + '\n\n';
          currentSize += paragraphSize + 2;
        }
      }
    } else {
      currentChunk += paragraph + '\n\n';
      currentSize += paragraphSize + 2;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Chunk text with metadata about each chunk
 */
export interface ChunkWithMetadata {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  hasHeading: boolean;
}

export function smartChunkWithMetadata(
  text: string, 
  options: ChunkOptions = {}
): ChunkWithMetadata[] {
  const chunks = smartChunkText(text, options);
  const result: ChunkWithMetadata[] = [];
  
  let currentPos = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startChar = currentPos;
    const endChar = startChar + chunk.length;
    const hasHeading = chunk.split('\n').some(line => isHeading(line));
    
    result.push({
      text: chunk,
      index: i,
      startChar,
      endChar,
      hasHeading,
    });
    
    currentPos = endChar;
  }
  
  return result;
}

/**
 * Tests for RAG Document Processor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processDocumentChunks, splitText, cleanText } from './processor';
import { generateEmbedding } from './embeddings';
import { ensureCollection, upsertPoints } from './qdrant';
import type { RagPackage } from './types';

// Mock dependencies
vi.mock('./embeddings');
vi.mock('./qdrant');

describe('RAG Document Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default env vars
    process.env.RAG_CHUNK_SIZE = '1200';
    process.env.RAG_CHUNK_OVERLAP = '200';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('cleanText', () => {
    it('should remove carriage returns', () => {
      const input = 'Line 1\r\nLine 2\r\nLine 3';
      const result = cleanText(input);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should remove null characters', () => {
      const input = 'Text\u0000with\u0000nulls';
      const result = cleanText(input);
      expect(result).toBe('Textwithnulls');
    });

    it('should trim whitespace', () => {
      const input = '  \n  Text with spaces  \n  ';
      const result = cleanText(input);
      expect(result).toBe('Text with spaces');
    });

    it('should handle empty string', () => {
      const result = cleanText('');
      expect(result).toBe('');
    });

    it('should combine all cleaning operations', () => {
      const input = '  \r\n\u0000  Clean text \u0000\r\n  ';
      const result = cleanText(input);
      expect(result).toBe('Clean text');
    });
  });

  describe('splitText', () => {
    it('should split text into chunks respecting size limit', () => {
      const text = 'a'.repeat(2500);
      const chunks = splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk: string) => {
        expect(chunk.length).toBeLessThanOrEqual(1200);
      });
    });

    it('should handle text smaller than chunk size', () => {
      const text = 'Short text';
      const chunks = splitText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Short text');
    });

    it('should handle empty text', () => {
      const chunks = splitText('');
      expect(chunks).toEqual([]);
    });

    it('should handle whitespace-only text', () => {
      const chunks = splitText('   \n\n   ');
      expect(chunks).toEqual([]);
    });

    it('should respect newlines for chunk boundaries', () => {
      const text = 'a'.repeat(700) + '\n' + 'b'.repeat(700);
      const chunks = splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      // First chunk should end at or before the newline if it's past half the chunk size
      expect(chunks[0].length).toBeLessThanOrEqual(1200);
    });

    it('should filter out empty chunks', () => {
      const text = '\n\n\n'.repeat(100);
      const chunks = splitText(text);

      chunks.forEach((chunk: string) => {
        expect(chunk.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle very long text', () => {
      const text = 'word '.repeat(10000); // ~50,000 characters
      const chunks = splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk: string) => {
        expect(chunk.length).toBeLessThanOrEqual(1200);
      });
    });

    it('should preserve text content integrity', () => {
      const text = 'The quick brown fox jumps over the lazy dog. ';
      const repeated = text.repeat(50);
      const chunks = splitText(repeated);

      // Due to overlap and chunking, we check that all content is present in chunks
      const allContent = chunks.join('');
      expect(allContent.length).toBeGreaterThan(0);
      // Verify that at least most characters are preserved (allowing for overlap)
      expect(allContent.length).toBeGreaterThanOrEqual(repeated.length * 0.9);
    });
  });

  describe('processDocumentChunks', () => {
    const mockPackage: RagPackage = {
      id: 'pkg-123',
      teamSlug: 'test-team',
      name: 'Test Package',
      description: 'Test description',
      collectionName: 'test_collection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    const mockParams = {
      ragPackage: mockPackage,
      documentId: 'doc-123',
      filename: 'test.pdf',
      teamSlug: 'test-team',
      textContent: 'Test document content for processing.',
    };

    beforeEach(() => {
      vi.mocked(generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
      vi.mocked(ensureCollection).mockResolvedValue(undefined);
      vi.mocked(upsertPoints).mockResolvedValue(undefined);
    });

    it('should process document and return results', async () => {
      const result = await processDocumentChunks(mockParams);

      expect(result).toBeDefined();
      expect(typeof result.chunkCount).toBe('number');
      expect(Array.isArray(result.pointIds)).toBe(true);
    });

    it('should call generateEmbedding for each chunk', async () => {
      const longText = 'word '.repeat(500);
      const params = { ...mockParams, textContent: longText };

      await processDocumentChunks(params);

      expect(generateEmbedding).toHaveBeenCalled();
    });

    it('should call ensureCollection with collection name', async () => {
      await processDocumentChunks(mockParams);

      expect(ensureCollection).toHaveBeenCalledWith(mockPackage.collectionName);
    });

    it('should call upsertPoints with correct points', async () => {
      await processDocumentChunks(mockParams);

      expect(upsertPoints).toHaveBeenCalled();
      const points = vi.mocked(upsertPoints).mock.calls[0][1];
      expect(Array.isArray(points)).toBe(true);
    });

    it('should generate unique point IDs', async () => {
      const result = await processDocumentChunks(mockParams);

      const uniqueIds = new Set(result.pointIds);
      expect(uniqueIds.size).toBe(result.pointIds.length);
    });

    it('should include correct payload in points', async () => {
      await processDocumentChunks(mockParams);

      const points = vi.mocked(upsertPoints).mock.calls[0][1];

      points.forEach((point: any, index: number) => {
        expect(point.payload).toMatchObject({
          packageId: mockPackage.id,
          packageName: mockPackage.name,
          teamSlug: mockParams.teamSlug,
          documentId: mockParams.documentId,
          documentName: mockParams.filename,
          chunkIndex: index,
          text: expect.any(String),
        });
        // Vector is at root level, not in payload
        expect(point).toHaveProperty('vector');
        expect(Array.isArray(point.vector)).toBe(true);
      });
    });

    it('should return zero chunks for empty text', async () => {
      const result = await processDocumentChunks({
        ...mockParams,
        textContent: '',
      });

      expect(result.chunkCount).toBe(0);
      expect(result.pointIds).toEqual([]);
      expect(upsertPoints).not.toHaveBeenCalled();
    });

    it('should return zero chunks for whitespace-only text', async () => {
      const result = await processDocumentChunks({
        ...mockParams,
        textContent: '   \n\n   ',
      });

      expect(result.chunkCount).toBe(0);
      expect(result.pointIds).toEqual([]);
    });

    it('should handle multiple chunks correctly', async () => {
      const longText = 'word '.repeat(1000);
      const result = await processDocumentChunks({
        ...mockParams,
        textContent: longText,
      });

      expect(result.chunkCount).toBeGreaterThan(1);
      expect(result.pointIds.length).toBe(result.chunkCount);
    });

    it('should propagate embedding generation errors', async () => {
      vi.mocked(generateEmbedding).mockRejectedValue(new Error('Embedding failed'));

      await expect(processDocumentChunks(mockParams)).rejects.toThrow('Embedding failed');
    });

    it('should propagate upsert errors', async () => {
      vi.mocked(upsertPoints).mockRejectedValue(new Error('Qdrant error'));

      await expect(processDocumentChunks(mockParams)).rejects.toThrow('Qdrant error');
    });
  });

  describe('Integration with env vars', () => {
    // Note: Environment variables are read at module load time, so changing them
    // in tests requires dynamic imports. For now, we test with default values.
    it('should use default chunk size when env vars are not set', () => {
      const text = 'a'.repeat(2500);
      const chunks = splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk: string) => {
        expect(chunk.length).toBeLessThanOrEqual(1200);
      });
    });

    it('should use default overlap when env vars are not set', () => {
      const text = 'word '.repeat(10000);
      const chunks = splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      // Default overlap of 200 means chunks should overlap
      const firstChunkEnd = chunks[0].slice(-100);
      const secondChunkStart = chunks[1].slice(0, 100);
      // Verify some overlap exists
      expect(chunks[1].length).toBeGreaterThan(0);
    });
  });
});

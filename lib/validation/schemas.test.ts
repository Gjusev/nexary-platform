/**
 * Tests for lib/validation/schemas.ts
 */

import { describe, it, expect } from 'vitest';
import {
  chatRequestSchema,
  ragDocumentSchema,
  ragPackageSchema,
  updateTeamSchema,
  dateRangeSchema,
} from './schemas';

describe('Validation Schemas', () => {
  describe('chatRequestSchema', () => {
    it('should validate valid chat query', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require messages field', () => {
      const result = chatRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should validate max tokens limit', () => {
      const result = chatRequestSchema.safeParse({
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        maxTokens: 5000, // Exceeds 4096 limit
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ragDocumentSchema', () => {
    it('should validate valid RAG document', () => {
      const result = ragDocumentSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        packageId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        chunkCount: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should require filename', () => {
      const result = ragDocumentSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        packageId: '123e4567-e89b-12d3-a456-426614174001',
        mimeType: 'application/pdf',
        size: 1024,
        chunkCount: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should validate file size is positive', () => {
      const result = ragDocumentSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        packageId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: -100, // Negative size
        chunkCount: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ragPackageSchema', () => {
    it('should validate valid RAG package', () => {
      const result = ragPackageSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        teamSlug: 'test-team',
        name: 'Test Package',
        description: 'A test RAG package',
      });
      expect(result.success).toBe(true);
    });

    it('should require package name', () => {
      const result = ragPackageSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        teamSlug: 'test-team',
        description: 'A test RAG package',
      });
      expect(result.success).toBe(false);
    });

    it('should enforce max name length', () => {
      const result = ragPackageSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        teamSlug: 'test-team',
        name: 'a'.repeat(101), // Exceeds 100 char limit
        description: 'Test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateTeamSchema', () => {
    it('should validate valid team update', () => {
      const result = updateTeamSchema.safeParse({
        name: 'Updated Team Name',
        description: 'Updated description',
      });
      expect(result.success).toBe(true);
    });

    it('should validate name length', () => {
      const result = updateTeamSchema.safeParse({
        name: 'a'.repeat(101), // Exceeds 100 char limit
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dateRangeSchema', () => {
    it('should accept valid date range', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date range (end before start)', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('should accept partial filters', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-01-01',
      });
      expect(result.success).toBe(true);
    });
  });
});

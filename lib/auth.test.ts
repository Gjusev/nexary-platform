/**
 * Tests for lib/auth.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { authService, AuthResult } from './auth';

describe('AuthService', () => {
  describe('authenticateRequest', () => {
    it('should return null when no authorization header is present', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await authService.authenticateRequest(request);
      expect(result).toBeNull();
    });

    it('should return AuthResult when Bearer token is present', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer test-token-123',
        },
      });
      const result = await authService.authenticateRequest(request);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('anonymous-user');
    });

    it('should return null when authorization header does not start with Bearer', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Basic test-token-123',
        },
      });
      const result = await authService.authenticateRequest(request);
      expect(result).toBeNull();
    });

    it('should handle empty Bearer token', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer',
        },
      });
      const result = await authService.authenticateRequest(request);
      // Note: NextRequest headers don't match "Bearer " with trailing space
      // The check is for "Bearer " prefix, so "Bearer" without space doesn't match
      expect(result).toBeNull();
    });
  });

  describe('AuthResult interface', () => {
    it('should have correct structure', () => {
      const authResult: AuthResult = {
        userId: 'test-user-123',
      };
      expect(authResult.userId).toBe('test-user-123');
    });
  });
});

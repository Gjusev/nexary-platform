/**
 * Tests for AI Provider Registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRegistry } from './registry';
import { AIProviderInterface, AIProviderId } from './types';

// Mock provider for testing
class MockProvider implements AIProviderInterface {
  id: AIProviderId;
  name: string;

  constructor(id: AIProviderId, name: string) {
    this.id = id;
    this.name = name;
  }

  getModels() {
    return [];
  }

  streamChat = vi.fn();
}

describe('aiRegistry (singleton)', () => {
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;

  beforeEach(() => {
    // Clear registry state before each test
    aiRegistry.clear();

    mockProvider1 = new MockProvider('openai', 'OpenAI');
    mockProvider2 = new MockProvider('gemini', 'Gemini');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new provider', () => {
      aiRegistry.register(mockProvider1);

      expect(aiRegistry.get('openai')).toBe(mockProvider1);
    });

    it('should register multiple providers', () => {
      aiRegistry.register(mockProvider1);
      aiRegistry.register(mockProvider2);

      expect(aiRegistry.getAll()).toHaveLength(2);
      expect(aiRegistry.getAll()).toContain(mockProvider1);
      expect(aiRegistry.getAll()).toContain(mockProvider2);
    });

    it('should overwrite existing provider with same ID', () => {
      const mockProvider1New = new MockProvider('openai', 'OpenAI Updated');

      aiRegistry.register(mockProvider1);
      aiRegistry.register(mockProvider1New);

      expect(aiRegistry.get('openai')).toBe(mockProvider1New);
      expect(aiRegistry.get('openai')?.name).toBe('OpenAI Updated');
    });

    it('should warn when overwriting existing provider', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      aiRegistry.register(mockProvider1);
      aiRegistry.register(mockProvider1);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provider openai is already registered')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('get', () => {
    it('should return registered provider by ID', () => {
      aiRegistry.register(mockProvider1);

      const provider = aiRegistry.get('openai');

      expect(provider).toBeDefined();
      expect(provider).toBe(mockProvider1);
    });

    it('should return undefined for non-existent provider', () => {
      const provider = aiRegistry.get('nonexistent');

      expect(provider).toBeUndefined();
    });

    it('should return correct provider when multiple are registered', () => {
      aiRegistry.register(mockProvider1);
      aiRegistry.register(mockProvider2);

      expect(aiRegistry.get('openai')).toBe(mockProvider1);
      expect(aiRegistry.get('gemini')).toBe(mockProvider2);
    });
  });

  describe('getAll', () => {
    it('should return all registered providers', () => {
      aiRegistry.register(mockProvider1);
      aiRegistry.register(mockProvider2);

      const providers = aiRegistry.getAll();

      expect(providers).toHaveLength(2);
      expect(providers).toContain(mockProvider1);
      expect(providers).toContain(mockProvider2);
    });
  });

  describe('isAvailable', () => {
    it('should return true for registered provider', () => {
      aiRegistry.register(mockProvider1);

      expect(aiRegistry.isAvailable('openai')).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      expect(aiRegistry.isAvailable('nonexistent')).toBe(false);
    });

    it('should return true after provider registration', () => {
      expect(aiRegistry.isAvailable('openai')).toBe(false);

      aiRegistry.register(mockProvider1);

      expect(aiRegistry.isAvailable('openai')).toBe(true);
    });
  });

  it('should be a singleton instance', () => {
    expect(aiRegistry).toBeDefined();
  });

  it('should persist providers across operations', () => {
    const provider = new MockProvider('mistral', 'Test 1');
    aiRegistry.register(provider);

    expect(aiRegistry.get('mistral')).toBe(provider);
  });

  it('should work with multiple provider types', () => {
    const provider = new MockProvider('anthropic', 'Anthropic Test');
    aiRegistry.register(provider);

    expect(aiRegistry.isAvailable('anthropic')).toBe(true);
    expect(aiRegistry.get('anthropic')).toBe(provider);
    expect(aiRegistry.getAll()).toContain(provider);
  });
});

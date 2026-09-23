/**
 * Tests for OpenAI Provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from './openai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    provider = new OpenAIProvider();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should have correct provider ID', () => {
      expect(provider.id).toBe('openai');
    });

    it('should have correct provider name', () => {
      expect(provider.name).toBe('OpenAI');
    });
  });

  describe('getModels', () => {
    it('should return all available OpenAI models', () => {
      const models = provider.getModels();

      expect(models).toHaveLength(10);
      expect(models.every(model => model.isAvailable)).toBe(true);
    });

    it('should include GPT-5.2 model with correct properties', () => {
      const models = provider.getModels();
      const gpt52 = models.find(m => m.id === 'gpt-5.2');

      expect(gpt52).toBeDefined();
      expect(gpt52?.name).toBe('GPT-5.2');
      expect(gpt52?.contextWindow).toBe(400000);
      expect(gpt52?.pricingTier).toBe('medium');
      expect(gpt52?.capabilities).toContain('Agentic');
      expect(gpt52?.capabilities).toContain('Reasoning');
    });

    it('should include GPT-5.2 Pro with high pricing tier', () => {
      const models = provider.getModels();
      const gpt52Pro = models.find(m => m.id === 'gpt-5.2-pro');

      expect(gpt52Pro).toBeDefined();
      expect(gpt52Pro?.pricingTier).toBe('high');
      expect(gpt52Pro?.capabilities).toContain('Deep Research');
    });

    it('should include GPT-5 Mini with low pricing tier', () => {
      const models = provider.getModels();
      const gpt5Mini = models.find(m => m.id === 'gpt-5-mini');

      expect(gpt5Mini).toBeDefined();
      expect(gpt5Mini?.pricingTier).toBe('low');
      expect(gpt5Mini?.capabilities).toContain('Fast');
    });

    it('should include o1 series reasoning models', () => {
      const models = provider.getModels();
      const o1Preview = models.find(m => m.id === 'o1-preview');
      const o1Mini = models.find(m => m.id === 'o1-mini');

      expect(o1Preview).toBeDefined();
      expect(o1Mini?.capabilities).toContain('Reasoning');
    });

    it('should include GPT-4o series with vision capabilities', () => {
      const models = provider.getModels();
      const gpt4o = models.find(m => m.id === 'gpt-4o');
      const gpt4oMini = models.find(m => m.id === 'gpt-4o-mini');

      expect(gpt4o).toBeDefined();
      expect(gpt4oMini).toBeDefined();
      expect(gpt4o?.capabilities).toContain('Vision');
      expect(gpt4oMini?.pricingTier).toBe('low');
    });

    it('should include GPT-3.5 Turbo with 16k context', () => {
      const models = provider.getModels();
      const gpt35Turbo = models.find(m => m.id === 'gpt-3.5-turbo');

      expect(gpt35Turbo).toBeDefined();
      expect(gpt35Turbo?.contextWindow).toBe(16000);
    });
  });

  describe('Model Context Windows', () => {
    it('should have models with 400k context window', () => {
      const models = provider.getModels();
      const largeContextModels = models.filter(m => m.contextWindow === 400000);

      expect(largeContextModels).toHaveLength(3);
      expect(largeContextModels.map(m => m.id)).toContain('gpt-5.2');
      expect(largeContextModels.map(m => m.id)).toContain('gpt-5.2-pro');
      expect(largeContextModels.map(m => m.id)).toContain('gpt-5-mini');
    });

    it('should have models with 128k context window', () => {
      const models = provider.getModels();
      const standardContextModels = models.filter(m => m.contextWindow === 128000);

      expect(standardContextModels.length).toBeGreaterThan(0);
    });
  });

  describe('streamChat', () => {
    it('should call OpenAI API with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream()
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const messages = [
        { role: 'user', content: 'Test message' }
      ];

      await provider.streamChat({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        maxTokens: 1000,
        topP: 1,
        topK: 1
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should convert simple text messages correctly', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream()
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ];

      await provider.streamChat({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        topP: 1,
        topK: 1
      });

      const callArgs = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callArgs.messages).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ]);
    });

    it('should convert messages with images for vision models', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream()
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const messages = [
        {
          role: 'user',
          content: 'What is in this image?',
          images: [
            { dataUrl: 'data:image/png;base64,iVBORw0KGgo...', type: 'image', name: 'test.png' }
          ]
        }
      ];

      await provider.streamChat({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        topP: 1,
        topK: 1
      });

      const callArgs = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callArgs.messages[0]).toEqual({
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,iVBORw0KGgo...' }
          }
        ]
      });
    });

    it('should handle messages with multiple images', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream()
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const messages = [
        {
          role: 'user',
          content: 'Compare these images',
          images: [
            { dataUrl: 'data:image/png;base64,abc123', type: 'image', name: 'test1.png' },
            { dataUrl: 'data:image/jpeg;base64,def456', type: 'image', name: 'test2.jpg' }
          ]
        }
      ];

      await provider.streamChat({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        topP: 1,
        topK: 1
      });

      const callArgs = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callArgs.messages[0].content).toHaveLength(3); // text + 2 images
    });

    it('should include stream parameter in request body', async () => {
      const mockResponse = {
        ok: true,
        body: new ReadableStream()
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await provider.streamChat({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
        stream: true,
        topP: 1,
        topK: 1
      });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.stream).toBe(true);
    });

    it('should throw error when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(provider.streamChat({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
        topP: 1,
        topK: 1
      })).rejects.toThrow('OPENAI_API_KEY not configured');
    });

    it('should throw error when API request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(provider.streamChat({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
        topP: 1,
        topK: 1
      })).rejects.toThrow('OpenAI API error: 429 - Rate limit exceeded');
    });

    it('should handle API error with status 500', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(provider.streamChat({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
        topP: 1,
        topK: 1
      })).rejects.toThrow('OpenAI API error: 500');
    });
  });

  describe('Pricing Tiers Distribution', () => {
    it('should have low pricing tier models', () => {
      const models = provider.getModels();
      const lowPricingModels = models.filter(m => m.pricingTier === 'low');

      expect(lowPricingModels.length).toBeGreaterThan(0);
      expect(lowPricingModels.map(m => m.id)).toContain('gpt-3.5-turbo');
    });

    it('should have medium pricing tier models', () => {
      const models = provider.getModels();
      const mediumPricingModels = models.filter(m => m.pricingTier === 'medium');

      expect(mediumPricingModels.length).toBeGreaterThan(0);
    });

    it('should have high pricing tier models', () => {
      const models = provider.getModels();
      const highPricingModels = models.filter(m => m.pricingTier === 'high');

      expect(highPricingModels.length).toBeGreaterThan(0);
    });
  });
});

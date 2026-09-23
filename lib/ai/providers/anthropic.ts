import { AIProviderInterface, AIModel, StreamOptions, AIProviderId } from '../types';
import { withAIErrorHandling } from '../error-parser';

/**
 * Anthropic Claude Models
 * Latest as of 2025
 */
const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    isAvailable: true,
    description: 'Most intelligent model with excellent reasoning, coding, and vision',
    pricingTier: 'medium',
    capabilities: ['Reasoning', 'Coding', 'Vision', 'Multimodal', 'Thinking']
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet (Legacy)',
    contextWindow: 200000,
    isAvailable: true,
    description: 'Previous version of Claude 3.5 Sonnet',
    pricingTier: 'medium',
    capabilities: ['Reasoning', 'Coding', 'Vision', 'Multimodal']
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    contextWindow: 200000,
    isAvailable: true,
    description: 'Most powerful model for complex reasoning and analysis',
    pricingTier: 'high',
    capabilities: ['Complex Reasoning', 'Coding', 'Vision', 'Multimodal']
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    contextWindow: 200000,
    isAvailable: true,
    description: 'Balanced model for performance and speed',
    pricingTier: 'medium',
    capabilities: ['Reasoning', 'Coding', 'Vision']
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    contextWindow: 200000,
    isAvailable: true,
    description: 'Fastest and most compact model for efficient responses',
    pricingTier: 'low',
    capabilities: ['Fast', 'Vision', 'Simple Tasks']
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    isAvailable: true,
    description: 'Latest Haiku model with improved capabilities',
    pricingTier: 'low',
    capabilities: ['Fast', 'Vision', 'Cost-Effective']
  },
];

/**
 * Anthropic AI Provider
 * Supports Claude 3 and 3.5 models with streaming, thinking, and vision
 */
export class AnthropicProvider implements AIProviderInterface {
  id: AIProviderId = 'anthropic';
  name = 'Anthropic';

  getModels(): AIModel[] {
    return ANTHROPIC_MODELS;
  }

  /**
   * Convert messages to Anthropic format, handling images for vision models
   * Anthropic uses a content array format with text and image blocks
   */
  private convertMessages(messages: StreamOptions['messages']): any[] {
    return messages
      .filter(msg => msg.role !== 'system') // System messages handled separately
      .map(msg => {
        // If message has images, convert to content array format
        if (msg.images && msg.images.length > 0) {
          const content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [
            { type: 'text', text: msg.content }
          ];

          // Add images in Anthropic format
          for (const image of msg.images) {
            // Extract base64 data from data URL
            const base64Data = image.dataUrl.split(',')[1] || image.dataUrl;

            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.type,
                data: base64Data
              }
            });
          }

          return {
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content
          };
        }

        // Regular text message
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        };
      });
  }

  /**
   * Stream chat completion from Anthropic Claude
   * Supports extended thinking for reasoning tasks and vision for images
   */
  async streamChat(options: StreamOptions): Promise<Response> {
    return withAIErrorHandling(
      this.name,
      async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error('ANTHROPIC_API_KEY not configured in environment variables');
        }

        // Anthropic API version
        const anthropicVersion = '2023-06-01';

        // Convert messages to Anthropic format (handles images)
        const anthropicMessages = this.convertMessages(options.messages);

        // Extract system message if present
        const systemMessage = options.messages.find(m => m.role === 'system')?.content;

        // Build request body
        const requestBody: Record<string, any> = {
          model: options.model,
          messages: anthropicMessages,
          max_tokens: options.maxTokens || 4096,
          stream: options.stream !== false,
        };

        // Add system message if present
        if (systemMessage) {
          requestBody.system = systemMessage;
        }

        // Add temperature if specified
        if (options.temperature !== undefined) {
          requestBody.temperature = options.temperature;
        }

        // Add top_p if specified (Anthropic uses top_p, not topK)
        if (options.topP !== undefined) {
          requestBody.top_p = options.topP;
        }

        // Enable extended thinking for Sonnet 3.5 models
        if (options.model.includes('sonnet') && options.model.includes('3-5')) {
          requestBody.thinking = {
            type: 'enabled',
            budget_tokens: 16000,
          };
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': anthropicVersion,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;

          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }

          // Throw an error that will be caught by withAIErrorHandling
          const error = new Error(JSON.stringify(errorData));
          (error as any).status = response.status;
          throw error;
        }

        return response;
      },
      options.model
    );
  }
}

/**
 * Helper to convert Anthropic stream events to standard format
 * Anthropic uses server-sent events with event types
 */
export function parseAnthropicStreamEvent(line: string): {
  type: string;
  data?: any;
} | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6);

  // Parse SSE data
  try {
    const parsed = JSON.parse(data);
    return { type: parsed.type, data: parsed };
  } catch {
    return { type: 'unknown', data };
  }
}

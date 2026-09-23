import { AIProviderInterface, AIModel, StreamOptions, AIProviderId } from '../types';
import { withAIErrorHandling } from '../error-parser';

const OPENAI_MODELS: AIModel[] = [
    {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        contextWindow: 400000,
        isAvailable: true,
        description: 'Latest flagship model for complex agentic tasks',
        pricingTier: 'medium',
        capabilities: ['Agentic', 'Reasoning', 'Vision', 'Multimodal']
    },
    {
        id: 'gpt-5.2-pro',
        name: 'GPT-5.2 Pro',
        contextWindow: 400000,
        isAvailable: true,
        description: 'Maximum capability model for research and analytics',
        pricingTier: 'high',
        capabilities: ['Deep Research', 'Complex Reasoning', 'Multimodal']
    },
    {
        id: 'gpt-5',
        name: 'GPT-5',
        contextWindow: 128000,
        isAvailable: true,
        description: 'Advanced general intelligence model',
        pricingTier: 'medium',
        capabilities: ['Reasoning', 'Coding', 'Multimodal']
    },
    {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        contextWindow: 400000,
        isAvailable: true,
        description: 'Efficient and intelligent small model',
        pricingTier: 'low',
        capabilities: ['Fast', 'Versatile']
    },
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        contextWindow: 128000,
        isAvailable: true,
        description: 'Reasoning model for complex tasks',
        pricingTier: 'high',
        capabilities: ['Reasoning', 'Coding', 'Math']
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        contextWindow: 128000,
        isAvailable: true,
        description: 'Fast, cost-effective reasoning model',
        pricingTier: 'medium',
        capabilities: ['Reasoning', 'Use Cases']
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        isAvailable: true,
        description: 'Most capable multimodal model for complex tasks',
        pricingTier: 'medium',
        capabilities: ['Vision', 'Function Calling', 'Multimodal']
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        isAvailable: true,
        description: 'Affordable and intelligent small model',
        pricingTier: 'low',
        capabilities: ['Fast', 'Cheap', 'Versatile']
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        isAvailable: true,
        description: 'High-capability model with 128k context',
        pricingTier: 'high',
        capabilities: ['Complex Reasoning', 'Coding']
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16000,
        isAvailable: true,
        description: 'Fast, inexpensive model for simple tasks',
        pricingTier: 'low',
        capabilities: ['Chat', 'Simple Tasks']
    },
];

export class OpenAIProvider implements AIProviderInterface {
    id: AIProviderId = 'openai';
    name = 'OpenAI';

    getModels(): AIModel[] {
        return OPENAI_MODELS;
    }

    /**
     * Convert messages to OpenAI format, handling images for vision models
     */
    private convertMessages(messages: StreamOptions['messages']): any[] {
        return messages.map(msg => {
            // If message has images, convert to content array format
            if (msg.images && msg.images.length > 0) {
                const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
                    { type: 'text', text: msg.content }
                ];

                // Add images
                for (const image of msg.images) {
                    // OpenAI expects base64 without the data:image/... prefix for the URL value
                    // But we need to include it in the format: data:image/jpeg;base64,...
                    content.push({
                        type: 'image_url',
                        image_url: { url: image.dataUrl }
                    });
                }

                return { role: msg.role, content };
            }

            // Regular text message
            return { role: msg.role, content: msg.content };
        });
    }

    async streamChat(options: StreamOptions): Promise<Response> {
        return withAIErrorHandling(
            this.name,
            async () => {
                const apiKey = process.env.OPENAI_API_KEY;
                if (!apiKey) {
                    throw new Error('OPENAI_API_KEY not configured');
                }

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: options.model,
                        messages: this.convertMessages(options.messages),
                        temperature: options.temperature,
                        max_tokens: options.maxTokens,
                        stream: options.stream !== false,
                    }),
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

import { AIProviderInterface, AIModel, StreamOptions, AIProviderId } from '../types';
import { withAIErrorHandling } from '../error-parser';

const MISTRAL_MODELS: AIModel[] = [
    {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        contextWindow: 32000,
        isAvailable: true,
        description: 'Mistral\'s flagship model with top-tier reasoning',
        pricingTier: 'high',
        capabilities: ['reasoning', 'coding', 'multilingual']
    },
    {
        id: 'mistral-medium',
        name: 'Mistral Medium',
        contextWindow: 32000,
        isAvailable: true,
        description: 'Balance of performance and speed',
        pricingTier: 'medium',
        capabilities: ['multilingual', 'reasoning']
    },
    {
        id: 'mistral-small',
        name: 'Mistral Small',
        contextWindow: 32000,
        isAvailable: true,
        description: 'Cost-effective model for simple tasks',
        pricingTier: 'low',
        capabilities: ['speed', 'efficiency']
    },
];

export class MistralProvider implements AIProviderInterface {
    id: AIProviderId = 'mistral';
    name = 'Mistral AI';

    getModels(): AIModel[] {
        return MISTRAL_MODELS;
    }

    async streamChat(options: StreamOptions): Promise<Response> {
        return withAIErrorHandling(
            this.name,
            async () => {
                const apiKey = process.env.MISTRAL_API_KEY;
                if (!apiKey) {
                    throw new Error('MISTRAL_API_KEY not configured');
                }

                const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: options.model,
                        messages: options.messages,
                        temperature: options.temperature,
                        max_tokens: options.maxTokens,
                        stream: true,
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

import { AIProviderInterface, AIModel, StreamOptions, AIProviderId } from '../types';
import { GoogleGenAI } from '@google/genai';
import { withAIErrorHandling } from '../error-parser';

/**
 * Gemini AI Models - Updated to match actual Google AI API model names
 * @see https://ai.google.dev/gemini-api/docs/models
 * Note: Model names must match exactly what the API expects
 */
const GEMINI_MODELS: AIModel[] = [
    {
        id: 'gemini-1.5-flash-latest',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1000000,
        isAvailable: true,
        description: 'Fast and versatile performance across diverse tasks',
        pricingTier: 'low',
        capabilities: ['speed', 'multimodal', 'long-context']
    },
    {
        id: 'gemini-1.5-pro-latest',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2000000,
        isAvailable: true,
        description: 'Complex reasoning tasks requiring more intelligence',
        pricingTier: 'medium',
        capabilities: ['reasoning', 'long-context', 'multimodal']
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Experimental',
        contextWindow: 1000000,
        isAvailable: true,
        description: 'Next generation features and improved capabilities (experimental)',
        pricingTier: 'low',
        capabilities: ['speed', 'multimodal', 'experimental']
    },
    {
        id: 'gemini-exp-1206',
        name: 'Gemini Experimental 1206',
        contextWindow: 2000000,
        isAvailable: true,
        description: 'Latest experimental model with enhanced reasoning',
        pricingTier: 'medium',
        capabilities: ['reasoning', 'experimental', 'multimodal']
    },
];

export class GeminiProvider implements AIProviderInterface {
    id: AIProviderId = 'gemini';
    name = 'Google Gemini';

    getModels(): AIModel[] {
        return GEMINI_MODELS;
    }

    /**
     * Stream chat completion with Gemini AI
     * Uses the new @google/genai SDK (recommended since May 2025)
     * @see https://ai.google.dev/gemini-api/docs/text-generation
     * @see https://github.com/googleapis/js-genai
     */
    async streamChat(options: StreamOptions): Promise<Response> {
        return withAIErrorHandling(
            this.name,
            async () => {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    throw new Error('GEMINI_API_KEY not configured');
                }

                // Initialize GoogleGenAI client with the new SDK
                const ai = new GoogleGenAI({ apiKey });

                // Model mapping: handle legacy models and default to latest
                const modelId = this.getModelId(options.model);

                // Extract system message for system instruction
                const systemMessage = options.messages.find(m => m.role === 'system');

                // Build the contents array for the new SDK
                const contents = options.messages
                    .filter(m => m.role !== 'system')
                    .map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }));

                if (contents.length === 0) {
                    throw new Error('No user message found in conversation');
                }

                // Generate content with streaming using the new SDK
                const requestBody: any = {
                    model: modelId,
                    contents: contents,
                    generationConfig: {
                        temperature: options.temperature ?? 0.7,
                        maxOutputTokens: options.maxTokens ?? 8192,
                        topP: options.topP ?? 0.95,
                        topK: options.topK ?? 40,
                    },
                };

                if (systemMessage) {
                    requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] };
                }

                const responseStream = ai.models.generateContentStream(requestBody);

                // Transform Gemini stream to standard SSE (Server-Sent Events) format
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    async start(controller) {
                        try {
                            for await (const chunk of await responseStream) {
                                // Extract text from the chunk
                                const chunkText = chunk.text;
                                if (chunkText) {
                                    const data = JSON.stringify({
                                        choices: [{
                                            delta: { content: chunkText }
                                        }]
                                    });
                                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                                }
                            }
                            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                            controller.close();
                        } catch (err) {
                            // Parse and throw appropriate error
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            try {
                                const errorData = JSON.parse(errorMessage);
                                throw new Error(JSON.stringify(errorData));
                            } catch {
                                throw new Error(errorMessage);
                            }
                        }
                    }
                });

                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            },
            options.model
        );
    }

    /**
     * Get the appropriate model ID, handling legacy model names
     * Maps old model names to current API-compatible names
     * @param requestedModel - Model ID from the request
     * @returns Actual model ID to use with the API
     */
    private getModelId(requestedModel: string): string {
        // Map legacy and common model names to actual API model names
        const modelMap: Record<string, string> = {
            'gemini-pro': 'gemini-1.5-flash-latest',
            'gemini-1.0-pro': 'gemini-1.5-flash-latest',
            'gemini-1.5-flash': 'gemini-1.5-flash-latest',
            'gemini-1.5-pro': 'gemini-1.5-pro-latest',
            'gemini-2.5-flash': 'gemini-1.5-flash-latest',
            'gemini-2.5-pro': 'gemini-1.5-pro-latest',
            'gemini-flash': 'gemini-1.5-flash-latest',
        };

        // Use mapped model if available
        const mappedModel = modelMap[requestedModel];
        if (mappedModel) return mappedModel;

        // If the requested model matches our available models, use it
        const availableModel = GEMINI_MODELS.find(m => m.id === requestedModel);
        if (availableModel) return requestedModel;

        // Default fallback to latest Flash model
        console.warn(`Unknown Gemini model '${requestedModel}', falling back to gemini-1.5-flash-latest`);
        return 'gemini-1.5-flash-latest';
    }
}

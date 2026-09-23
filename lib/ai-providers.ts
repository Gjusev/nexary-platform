import { aiRegistry } from './ai/registry';
import { OpenAIProvider } from './ai/providers/openai';
import { GeminiProvider } from './ai/providers/gemini';
import { MistralProvider } from './ai/providers/mistral';
import { AnthropicProvider } from './ai/providers/anthropic';
import { AIProviderId, AIModel, ProviderConfig, AIProviderInterface, StreamOptions } from './ai/types';

export type { AIProviderId as AIProvider, AIModel, ProviderConfig, StreamOptions };

// Initialize Registry with default providers
// In a real app, you might load these dynamically or conditional on env vars
if (!aiRegistry.get('openai')) aiRegistry.register(new OpenAIProvider());
if (!aiRegistry.get('gemini')) aiRegistry.register(new GeminiProvider());
if (!aiRegistry.get('mistral')) aiRegistry.register(new MistralProvider());
if (!aiRegistry.get('anthropic')) aiRegistry.register(new AnthropicProvider());

/**
 * @deprecated Use aiRegistry.getAll() or specific usage.
 * Kept for backward compatibility with UI components that iterate this object.
 */
export const PROVIDERS: Record<string, ProviderConfig> = {};

// Populate PROVIDERS constant for backward compatibility
// This maps the new registry format back to the old config format expected by the UI
aiRegistry.getAll().forEach(p => {
    PROVIDERS[p.id] = {
        id: p.id,
        name: p.name,
        apiKeyEnvVar: `${p.id.toUpperCase()}_API_KEY`,
        isAvailable: true, // If it's in the registry, we treat it as available
        models: p.getModels()
    };
});


export function getProvider(providerId: string): AIProviderInterface {
    const provider = aiRegistry.get(providerId);
    if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
    }
    return provider;
}

export function getModel(providerId: string, modelId: string): AIModel | undefined {
    const provider = aiRegistry.get(providerId);
    return provider?.getModels().find(m => m.id === modelId);
}

export function getModelsByProvider(providerId: string): AIModel[] {
    const provider = aiRegistry.get(providerId);
    return provider ? provider.getModels() : [];
}

/**
 * Classification result interface
 */
export interface ClassificationResult {
    provider: AIProviderId;
    model: string;
    reason: string;
    confidence: number;
}


/**
 * Smartly selects the best model based on the prompt complexity and content.
 */
export function getRecommendedModel(prompt: string, currentProvider?: string): ClassificationResult {
    const text = prompt.toLowerCase();
    const length = prompt.length;

    // logic for coding/complexity (simplified for now)
    const isCoding = /code|function|api|debug|fix|typescript|react|next\.js|node|python|sql|db|error|exception/i.test(text);
    const isCreative = /write|story|poem|creative|idea|brainstorm/i.test(text);
    const isSimple = length < 50 && !isCoding && !isCreative;

    // Default to OpenAI GPT-4o-mini for simple things
    if (isSimple) {
        return {
            provider: 'openai',
            model: 'gpt-4o-mini',
            reason: 'Simple query, using efficient model.',
            confidence: 0.9
        };
    }

    // Default High Capability
    return {
        provider: 'openai',
        model: 'gpt-4o',
        reason: 'Complex query, using high-capability model.',
        confidence: 0.8
    };
}


/**
 * Unified streaming entry point.
 */
export async function streamChatCompletion(
    providerId: string,
    options: StreamOptions
): Promise<Response> {
    const provider = aiRegistry.get(providerId);
    if (!provider) {
        throw new Error(`Provider ${providerId} not found or not initialized`);
    }

    return provider.streamChat(options);
}

// Re-export specific stream functions if needed for legacy or specific use
// But generally streamChatCompletion should be used.
export async function streamOpenAI(apiKey: string, options: StreamOptions): Promise<Response> {
    const provider = aiRegistry.get('openai');
    return provider!.streamChat(options);
}

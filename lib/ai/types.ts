export interface StreamOptions {
    topP: number;
    topK: number;
    model: string;
    messages: { role: string; content: string; images?: MessageImage[] }[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface MessageImage {
  dataUrl: string;
  type: string;
  name: string;
}

export interface AIModel {
    id: string;
    name: string;
    contextWindow: number;
    costPer1kTokens?: number;
    isAvailable: boolean;
    description?: string;
    pricingTier?: 'free' | 'low' | 'medium' | 'high';
    capabilities?: string[];
}

export interface ProviderConfig {
    id: AIProviderId;
    name: string;
    apiKeyEnvVar: string;
    isAvailable: boolean;
    models: AIModel[];
}

export interface AIProviderInterface {
    id: AIProviderId;
    name: string;
    getModels(): AIModel[];
    streamChat(options: StreamOptions): Promise<Response>;
}

export type AIProviderId = 'openai' | 'gemini' | 'mistral' | 'anthropic' | 'aleph-alpha';

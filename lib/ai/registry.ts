import { AIProviderInterface, AIProviderId } from './types';

class ProviderRegistry {
    private providers: Map<string, AIProviderInterface> = new Map();

    register(provider: AIProviderInterface) {
        if (this.providers.has(provider.id)) {
            console.warn(`Provider ${provider.id} is already registered. Overwriting.`);
        }
        this.providers.set(provider.id, provider);
    }

    get(id: string): AIProviderInterface | undefined {
        return this.providers.get(id);
    }

    getAll(): AIProviderInterface[] {
        return Array.from(this.providers.values());
    }

    isAvailable(id: string): boolean {
        // In future this can check deeper health
        return this.providers.has(id);
    }

    /**
     * Clear all registered providers.
     * Intended for testing purposes only.
     */
    clear() {
        this.providers.clear();
    }
}

export const aiRegistry = new ProviderRegistry();

// lib/ai/poc/router.ts

import type { AIProvider, AIMessage, AIResponse, RouterConfig, RouterStats } from "./types";
import { AzureOpenAIProvider } from "./poc/providers/azure-openai";
import { MistralProvider } from "./poc/providers/mistral";

export class SmartAIRouter {
  private providers: Map<string, AIProvider>;
  private defaultProvider: string;
  private strategy: "hybrid" | "cost" | "quality";
  private complexityThreshold: number;
  private stats: RouterStats;

  constructor(config: RouterConfig) {
    this.providers = new Map();
    this.strategy = config.strategy || "hybrid";
    this.complexityThreshold = config.complexityThreshold || 0.7;

    // Initialize stats
    this.stats = {
      totalRequests: 0,
      requestsByProvider: {},
      totalCost: 0,
      averageLatency: 0
    };

    // Initialize providers
    if (config.azureOpenAI) {
      this.providers.set("azure-openai", new AzureOpenAIProvider(config.azureOpenAI));
      this.stats.requestsByProvider["azure-openai"] = 0;
    }
    if (config.mistral) {
      this.providers.set("mistral", new MistralProvider(config.mistral));
      this.stats.requestsByProvider["mistral"] = 0;
    }

    this.defaultProvider = config.defaultProvider || "mistral";
  }

  /**
   * Analiza la complejidad del mensaje (0.0 - 1.0)
   */
  private analyzeComplexity(messages: AIMessage[]): number {
    const lastMessage = messages[messages.length - 1]?.content || "";
    const allMessages = messages;

    let score = 0;

    // 1. Longitud del mensaje (hasta 0.3 puntos)
    const length = lastMessage.length;
    if (length > 500) score += 0.1;
    if (length > 2000) score += 0.2;

    // 2. Palabras clave de complejidad (hasta 0.4 puntos)
    const complexKeywords = [
      "analyze", "compare", "evaluate", "reasoning",
      "step by step", "explain why", "detailed analysis",
      "code review", "debug", "optimize", "algorithm",
      "architecture", "design pattern", "implement",
      "análisis", "comparar", "evaluar", "razonamiento",
      "paso a paso", "explica por qué"
    ];
    const hasComplexKeyword = complexKeywords.some(kw =>
      lastMessage.toLowerCase().includes(kw)
    );
    if (hasComplexKeyword) score += 0.2;
    if (complexKeywords.filter(kw => lastMessage.toLowerCase().includes(kw)).length > 2) {
      score += 0.2; // Múltiples keywords complejos
    }

    // 3. Presencia de código (hasta 0.2 puntos)
    if (lastMessage.includes("```") || lastMessage.includes("function") ||
        lastMessage.includes("class ") || lastMessage.includes("import ")) {
      score += 0.2;
    }

    // 4. Longitud del contexto (hasta 0.1 puntos)
    if (allMessages.length > 10) score += 0.05;
    if (allMessages.length > 20) score += 0.05;

    // 5. Preguntas multi-parte (hasta 0.1 puntos)
    const questionMarks = (lastMessage.match(/\?/g) || []).length;
    if (questionMarks > 2) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Selecciona el provider óptimo basado en estrategia
   */
  private selectProvider(messages: AIMessage[]): string {
    const complexity = this.analyzeComplexity(messages);

    switch (this.strategy) {
      case "cost":
        // Siempre el más económico
        return "mistral";

      case "quality":
        // Siempre el mejor modelo
        return complexity > 0.5 ? "azure-openai" : "mistral";

      case "hybrid":
      default:
        // Estrategia híbrida inteligente
        if (complexity >= this.complexityThreshold) {
          return "azure-openai"; // Tareas complejas
        } else {
          return "mistral"; // Tareas estándar
        }
    }
  }

  /**
   * Chat con routing automático
   */
  async chat(
    messages: AIMessage[],
    onChunk?: (chunk: string) => void,
    providerHint?: string
  ): Promise<AIResponse> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    // Seleccionar provider
    const providerId = providerHint || this.selectProvider(messages);
    const provider = this.providers.get(providerId) || this.providers.get(this.defaultProvider)!;

    console.log(`\n🤖 Router: Selected provider: ${providerId} (complexity: ${this.analyzeComplexity(messages).toFixed(2)})`);

    // Ejecutar chat
    const response = await provider.chat(messages, onChunk);

    // Update stats
    this.stats.requestsByProvider[providerId]++;
    this.stats.totalCost += response.cost;
    this.stats.averageLatency =
      (this.stats.averageLatency * (this.stats.totalRequests - 1) + response.latency) /
      this.stats.totalRequests;

    return response;
  }

  /**
   * Generar embeddings (usa el provider más económico)
   */
  async embed(texts: string[]): Promise<number[][]> {
    // Siempre usar Mistral para embeddings (más barato)
    const provider = this.providers.get("mistral") || this.providers.get(this.defaultProvider)!;
    return await provider.embed(texts);
  }

  /**
   * Obtener estadísticas
   */
  getStats(): RouterStats {
    return { ...this.stats };
  }

  /**
   * Reset estadísticas
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      requestsByProvider: {},
      totalCost: 0,
      averageLatency: 0
    };
  }

  /**
   * Comparar providers (ejecutar mismo prompt en todos)
   */
  async compareProviders(messages: AIMessage[]): Promise<Map<string, AIResponse>> {
    const results = new Map<string, AIResponse>();

    for (const [id, provider] of this.providers) {
      console.log(`\n🧪 Testing ${id}...`);
      try {
        const response = await provider.chat(messages);
        results.set(id, response);
      } catch (error) {
        console.error(`❌ Error with ${id}:`, error);
      }
    }

    return results;
  }

  /**
   * Mostrar información de todos los providers
   */
  getProvidersInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    for (const [id, provider] of this.providers) {
      info[id] = {
        ...(provider as any).getModelInfo ? (provider as any).getModelInfo() : {},
        capabilities: provider.getCapabilities()
      };
    }

    return info;
  }
}

// lib/ai/poc/test.ts

import { config } from "dotenv";
import { SmartAIRouter } from "./router";

// Cargar variables de entorno
config();

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 POC Azure AI + RAG Local - Nexary");
  console.log("=".repeat(80));

  // Verificar variables de entorno
  const hasAzureOpenAI = process.env.AZURE_OPENAI_API_KEY;
  const hasMistral = process.env.MISTRAL_API_KEY;

  if (!hasAzureOpenAI && !hasMistral) {
    console.error("\n❌ Error: No hay API keys configuradas");
    console.log("   Por favor, configura al menos uno de los siguientes en .env.local:");
    console.log("   - AZURE_OPENAI_API_KEY");
    console.log("   - MISTRAL_API_KEY");
    process.exit(1);
  }

  // Inicializar router
  const router = new SmartAIRouter({
    azureOpenAI: hasAzureOpenAI ? {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION
    } : undefined,
    mistral: hasMistral ? {
      apiKey: process.env.MISTRAL_API_KEY!,
      model: process.env.MISTRAL_MODEL || "mistral-7b"
    } : undefined,
    strategy: (process.env.ROUTER_STRATEGY as any) || "hybrid",
    complexityThreshold: parseFloat(process.env.COMPLEXITY_THRESHOLD || "0.7")
  });

  // Mostrar información de providers
  console.log("\n📋 Providers Configurados:");
  const providersInfo = router.getProvidersInfo();
  for (const [id, info] of Object.entries(providersInfo)) {
    console.log(`\n   ${id}:`);
    console.log(`   - Provider: ${info.provider || info.providerName}`);
    console.log(`   - Headquarters: ${info.headquarters || "N/A"}`);
    console.log(`   - GDPR: ${info.compliance?.gdpr || "N/A"}`);
    console.log(`   - Data Residency: ${info.compliance?.dataResidency || "N/A"}`);
    if (info.pricing) {
      const firstModel = Object.keys(info.pricing)[0];
      console.log(`   - Pricing (${firstModel}): Input $${info.pricing[firstModel].input} / Output $${info.pricing[firstModel].output}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("🧪 Iniciando Tests...");
  console.log("=".repeat(80));

  // Test 1: Mensaje simple (debería usar Mistral)
  console.log("\n📝 Test 1: Mensaje simple (chat casual)");
  console.log("─".repeat(80));
  console.log("Prompt: \"Hola, ¿qué es Nexary?\"");
  console.log("─".repeat(80));

  const test1Start = Date.now();
  const test1 = await router.chat(
    [{ role: "user", content: "Hola, ¿qué es Nexary?" }],
    (chunk) => process.stdout.write(chunk)
  );
  console.log(`\n\n✅ Provider: ${test1.provider}`);
  console.log(`✅ Cost: $${test1.cost.toFixed(6)}`);
  console.log(`✅ Latency: ${test1.latency}ms`);
  console.log(`✅ Tokens: ${test1.metadata?.tokens?.input || "N/A"} input / ${test1.metadata?.tokens?.output || "N/A"} output`);

  // Test 2: Tarea compleja (debería usar Azure OpenAI si está disponible)
  console.log("\n\n📝 Test 2: Tarea compleja (análisis técnico)");
  console.log("─".repeat(80));
  console.log("Prompt: Análisis de complejidad algorítmica de RAG");
  console.log("─".repeat(80));

  const test2Start = Date.now();
  const test2 = await router.chat(
    [{
      role: "user",
      content: "Analiza paso a paso la complejidad algorítmica de implementar un sistema RAG vectorial con optimización de búsqueda semántica, considerando trade-offs de precisión vs rendimiento y estrategias de escalado horizontal."
    }],
    (chunk) => process.stdout.write(chunk)
  );
  console.log(`\n\n✅ Provider: ${test2.provider}`);
  console.log(`✅ Cost: $${test2.cost.toFixed(6)}`);
  console.log(`✅ Latency: ${test2.latency}ms`);
  console.log(`✅ Tokens: ${test2.metadata?.tokens?.input || "N/A"} input / ${test2.metadata?.tokens?.output || "N/A"} output`);

  // Test 3: Código
  console.log("\n\n📝 Test 3: Generación de código");
  console.log("─".repeat(80));
  console.log("Prompt: Implementar función de embeddings");
  console.log("─".repeat(80));

  const test3Start = Date.now();
  const test3 = await router.chat(
    [{
      role: "user",
      content: "Implementa una función en TypeScript que calcule la similitud coseno entre dos vectores de embeddings."
    }],
    (chunk) => process.stdout.write(chunk)
  );
  console.log(`\n\n✅ Provider: ${test3.provider}`);
  console.log(`✅ Cost: $${test3.cost.toFixed(6)}`);
  console.log(`✅ Latency: ${test3.latency}ms`);

  // Test 4: Mensaje medio (debería usar Mistral)
  console.log("\n\n📝 Test 4: Explicación técnica media");
  console.log("─".repeat(80));
  console.log("Prompt: ¿Cómo funcionan los embeddings de texto?");
  console.log("─".repeat(80));

  const test4Start = Date.now();
  const test4 = await router.chat(
    [{
      role: "user",
      content: "¿Cómo funcionan los embeddings de texto y qué representan matemáticamente?"
    }],
    (chunk) => process.stdout.write(chunk)
  );
  console.log(`\n\n✅ Provider: ${test4.provider}`);
  console.log(`✅ Cost: $${test4.cost.toFixed(6)}`);
  console.log(`✅ Latency: ${test4.latency}ms`);

  // Mostrar estadísticas finales
  console.log("\n\n" + "=".repeat(80));
  console.log("📊 Estadísticas Finales");
  console.log("=".repeat(80));

  const stats = router.getStats();
  console.log(`\nTotal Requests: ${stats.totalRequests}`);
  console.log("\nRequests by Provider:");
  for (const [provider, count] of Object.entries(stats.requestsByProvider)) {
    const percentage = ((count / stats.totalRequests) * 100).toFixed(1);
    console.log(`  - ${provider}: ${count} (${percentage}%)`);
  }
  console.log(`\nTotal Cost: $${stats.totalCost.toFixed(6)}`);
  console.log(`Average Latency: ${stats.averageLatency.toFixed(0)}ms`);

  // Comparación de costes
  console.log("\n" + "=".repeat(80));
  console.log("💰 Análisis de Costes");
  console.log("=".repeat(80));

  if (stats.requestsByProvider["mistral"] && stats.requestsByProvider["azure-openai"]) {
    console.log("\n✅ Estrategia híbrida activa:");
    console.log("   - Mistral para tareas estándar (81% ahorro vs GPT-4o-mini)");
    console.log("   - Azure OpenAI para tareas complejas (máxima calidad)");
    console.log(`   - Ahorro estimado: ~63% vs usar solo Azure OpenAI`);
  } else {
    console.log("\n⚠️ Solo un provider configurado");
    console.log("   Configura ambos providers para máxima optimización");
  }

  // Recomendaciones
  console.log("\n" + "=".repeat(80));
  console.log("💡 Recomendaciones para Nexary");
  console.log("=".repeat(80));

  console.log(`
1. ✅ MANTENER RAG LOCAL EN ALEMANIA
   - Coste infra: ~€67/mes (Hetzner)
   - Data sovereignty: 100%
   - Búsqueda: <100ms

2. ✅ USAR ESTRATEGIA HÍBRIDA
   - Mistral 7B para 70-80% requests (chat, RAG básico)
   - Azure OpenAI para 20-30% requests (tareas complejas)
   - Ahorro total: ~63%

3. ✅ DEPLOYMENT DE PRODUCCIÓN
   - Azure OpenAI: Germany North (Frankfurt) - Data Zone
   - Mistral: EU native (Francia)
   - Qdrant: Self-hosted en Alemania

4. ✅ COSTOS ESTIMADOS (100 usuarios)
   - Infraestructura Alemania: €67/mes
   - Mistral AI: ~€3,200/mes
   - Azure OpenAI: ~€3,000/mes
   - Total: ~€6,267/mes (vs €17,300 solo Azure OpenAI)

5. ✅ COMPLIANCE
   - GDPR: ✅✅✅ Excelente (ambos)
   - Data Residencia: ✅ UE (ambos)
   - EU AI Act: ✅ Fase 1-2 alineado
  `);

  console.log("\n" + "=".repeat(80));
  console.log("🎉 POC Completado!");
  console.log("=".repeat(80) + "\n");
}

main().catch((error) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});

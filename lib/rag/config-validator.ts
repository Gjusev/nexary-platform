/**
 * RAG Configuration Validator
 * Verifica que todas las variables de entorno necesarias estén configuradas
 */

export type RagConfigStatus = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  features: {
    qdrant: boolean;
    minio: boolean;
    textExtractor: boolean;
    embeddings: boolean;
  };
};

export function validateRagConfig(): RagConfigStatus {
  const errors: string[] = [];
  const warnings: string[] = [];
  const features = {
    qdrant: false,
    minio: false,
    textExtractor: false,
    embeddings: false,
  };

  // Verificar Qdrant (REQUERIDO)
  if (!process.env.QDRANT_URL) {
    errors.push('QDRANT_URL no está configurado - RAG no funcionará');
  } else {
    features.qdrant = true;
    if (!process.env.QDRANT_API_KEY) {
      warnings.push('QDRANT_API_KEY no está configurado - puede requerirse según tu instalación');
    }
  }

  // Verificar tamaño de vectores
  const vectorSize = Number(process.env.QDRANT_VECTOR_SIZE ?? 3072);
  if (vectorSize !== 3072 && vectorSize !== 1536 && vectorSize !== 768 && vectorSize !== 384) {
    warnings.push(`QDRANT_VECTOR_SIZE=${vectorSize} - asegúrate que coincide con tu modelo de embeddings`);
  }

  // Verificar OpenAI (REQUERIDO para embeddings)
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY no está configurado - no se pueden generar embeddings');
  } else {
    features.embeddings = true;
  }

  // Verificar MinIO (OPCIONAL)
  const hasMinioEndpoint = !!process.env.MINIO_ENDPOINT;
  const hasMinioKeys = !!process.env.MINIO_ACCESS_KEY && !!process.env.MINIO_SECRET_KEY;
  
  if (hasMinioEndpoint && !hasMinioKeys) {
    warnings.push('MINIO_ENDPOINT está configurado pero faltan MINIO_ACCESS_KEY o MINIO_SECRET_KEY');
  } else if (!hasMinioEndpoint && hasMinioKeys) {
    warnings.push('MINIO_ACCESS_KEY/SECRET_KEY están configurados pero falta MINIO_ENDPOINT');
  } else if (hasMinioEndpoint && hasMinioKeys) {
    features.minio = true;
  }

  // Verificar Text Extractor (OPCIONAL)
  if (process.env.TEXT_EXTRACTOR_URL) {
    features.textExtractor = true;
  } else {
    warnings.push('TEXT_EXTRACTOR_URL no configurado - extracción de PDFs/DOCs complejos puede fallar');
  }

  const isValid = errors.length === 0 && features.qdrant && features.embeddings;

  return {
    isValid,
    errors,
    warnings,
    features,
  };
}

export function logRagConfigStatus(): void {
  const status = validateRagConfig();
  
  if (status.errors.length > 0) {
    console.error('\n❌ Errores:');
    status.errors.forEach(err => console.error(`  - ${err}`));
  }
  
  if (status.warnings.length > 0) {
    console.warn('\n⚠️  Advertencias:');
    status.warnings.forEach(warn => console.warn(`  - ${warn}`));
  }
  
  }

/**
 * Lanza error si la configuración no es válida
 */
export function requireValidRagConfig(): void {
  const status = validateRagConfig();
  if (!status.isValid) {
    throw new Error(
      `RAG configuration is invalid:\n${status.errors.join('\n')}`
    );
  }
}

/**
 * Verifica si una feature específica está disponible
 */
export function isFeatureAvailable(feature: keyof RagConfigStatus['features']): boolean {
  return validateRagConfig().features[feature];
}

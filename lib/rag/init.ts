/**
 * RAG System Initialization Script
 * Validates configuration and logs startup status
 */

import { logRagConfigStatus, validateRagConfig } from './config-validator';

export function initializeRagSystem() {
  logRagConfigStatus();
  
  const status = validateRagConfig();
  
  if (!status.isValid) {
    console.error('❌ RAG System initialization FAILED');
    console.error('   Please check the errors above and configure the required environment variables.\n');
    return false;
  }
  
  if (status.warnings.length > 0) {
    }
  
  return true;
}

// Auto-run on import if not in test environment
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  initializeRagSystem();
}

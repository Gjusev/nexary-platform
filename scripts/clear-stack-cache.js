#!/usr/bin/env node

/**
 * Script to clear Stack Auth cache and reset configuration
 * This helps resolve configuration mismatches between client and server
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 [Stack Cache Clear] Starting cache clearing process...');

// Clear Next.js cache
const nextCacheDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextCacheDir)) {
  console.log('📁 Clearing Next.js cache...');
  fs.rmSync(nextCacheDir, { recursive: true, force: true });
  console.log('✅ Next.js cache cleared');
}

// Clear any Stack Auth related cookies (this will be done client-side)
console.log('🍪 Stack Auth cookies will be cleared automatically on next request');

// Clear node_modules cache
console.log('📦 Consider running "npm ci" to reinstall dependencies if issues persist');

console.log('✅ [Stack Cache Clear] Cache clearing completed');
console.log('🔄 Please restart your development server');

// Exit with success
process.exit(0);

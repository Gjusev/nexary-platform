/**
 * Script to remove console.log statements from source files
 * Replaces with logger where appropriate, removes debug logs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SOURCE_DIRS = [
  'lib',
  'components',
  'app/api',
  'middleware',
];

const CONSOLE_PATTERNS = [
  /console\.log\([^)]*\);?\s*\n?/g,
  /console\.debug\([^)]*\);?\s*\n?/g,
  /console\.info\([^)]*\);?\s*\n?/g,
];

// Files to skip (logger.ts itself, test files, etc)
const SKIP_PATTERNS = [
  'logger.ts',
  '.test.ts',
  '.spec.ts',
  'vitest',
];

function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
}

function processFile(filePath: string): number {
  if (shouldSkipFile(filePath)) {
    return 0;
  }

  const content = readFileSync(filePath, 'utf-8');
  let newContent = content;
  let removedCount = 0;

  // Count console statements before
  const beforeCount = (content.match(/console\./g) || []).length;

  // Remove console.log, console.debug, console.info
  CONSOLE_PATTERNS.forEach(pattern => {
    const matches = newContent.match(pattern);
    if (matches) {
      removedCount += matches.length;
    }
    newContent = newContent.replace(pattern, '');
  });

  // Keep console.error and console.warn but replace with logger where appropriate
  // Replace console.error with logger.error
  newContent = newContent.replace(
    /console\.error\(([^)]+)\);?/g,
    (match, args) => {
      // Check if file already imports logger
      if (content.includes("from '@/lib/logger'") || content.includes("from \"@/lib/logger\"")) {
        return `logger.error(${args});`;
      }
      return match; // Keep original if logger not imported
    }
  );

  // Replace console.warn with logger.warn
  newContent = newContent.replace(
    /console\.warn\(([^)]+)\);?/g,
    (match, args) => {
      if (content.includes("from '@/lib/logger'") || content.includes("from \"@/lib/logger\"")) {
        return `logger.warn(${args});`;
      }
      return match;
    }
  );

  // Only write if content changed
  if (newContent !== content) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  const afterCount = (newContent.match(/console\.(log|debug|info)/g) || []).length;
  return beforeCount - afterCount;
}

function processDirectory(dir: string): { files: number; removed: number } {
  let filesProcessed = 0;
  let totalRemoved = 0;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        const result = processDirectory(fullPath);
        filesProcessed += result.files;
        totalRemoved += result.removed;
      } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.js') || entry.endsWith('.jsx'))) {
        const removed = processFile(fullPath);
        if (removed > 0) {
          filesProcessed++;
          totalRemoved += removed;
        }
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }

  return { files: filesProcessed, removed: totalRemoved };
}

// Main execution
console.log('🧹 Cleaning console.log statements...\n');

let totalFiles = 0;
let totalRemoved = 0;

SOURCE_DIRS.forEach(dir => {
  console.log(`Processing ${dir}/...`);
  const result = processDirectory(dir);
  console.log(`  ✅ ${result.files} files, ${result.removed} statements removed`);
  totalFiles += result.files;
  totalRemoved += result.removed;
});

console.log(`\n✨ Total: ${totalFiles} files processed, ${totalRemoved} console statements removed`);

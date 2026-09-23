/**
 * Safe Script to remove console.log statements from source files
 * Uses proper parentheses and string balancing
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SOURCE_DIRS = [
  'lib',
  'components',
  'app/api',
  'middleware',
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

/**
 * Find the complete console statement by balancing parentheses and strings
 */
function findConsoleStatementEnd(code: string, startPos: number): number {
  let i = startPos;
  let parenDepth = 0;
  let inString = false;
  let stringChar = '';
  let escapeNext = false;

  while (i < code.length) {
    const char = code[i];

    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      i++;
      continue;
    }

    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      i++;
      continue;
    }

    if (inString) {
      if (char === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
      if (parenDepth === 0) {
        // Found the matching closing paren
        // Now skip whitespace and find semicolon or end of line
        i++;
        while (i < code.length && (code[i] === ' ' || code[i] === '\t' || code[i] === ';')) {
          i++;
        }
        return i;
      }
    }

    i++;
  }

  return code.length;
}

/**
 * Remove console statements using proper parsing
 */
function removeConsoleStatements(content: string, consoleType: 'log' | 'debug' | 'info'): { content: string; count: number } {
  const pattern = new RegExp(`console\\.${consoleType}\\(`, 'g');
  let match;
  let removedCount = 0;
  let result = content;

  while ((match = pattern.exec(result)) !== null) {
    const startPos = match.index;
    const endPos = findConsoleStatementEnd(result, startPos + `console.${consoleType}(`.length - 1);

    // Check if there's a newline after the statement
    const hasNewline = endPos < result.length && result[endPos] === '\n';

    // Remove the statement
    result = result.substring(0, startPos) + (hasNewline ? '\n' : '') + result.substring(endPos + (hasNewline ? 1 : 0));

    // Reset regex to search in the new content
    pattern.lastIndex = 0;
    removedCount++;
  }

  return { content: result, count: removedCount };
}

function processFile(filePath: string): { removed: number; errors: string[] } {
  if (shouldSkipFile(filePath)) {
    return { removed: 0, errors: [] };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    let newContent = content;
    let totalRemoved = 0;

    // Remove console.log, console.debug, console.info
    ['log', 'debug', 'info'].forEach(consoleType => {
      const result = removeConsoleStatements(newContent, consoleType as 'log' | 'debug' | 'info');
      newContent = result.content;
      totalRemoved += result.count;
    });

    // Only write if content changed and not empty
    if (newContent !== content && newContent.trim().length > 0) {
      writeFileSync(filePath, newContent, 'utf-8');
    }

    return { removed: totalRemoved, errors: [] };
  } catch (error) {
    return { removed: 0, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

function processDirectory(dir: string): { files: number; removed: number; errors: string[] } {
  let filesProcessed = 0;
  let totalRemoved = 0;
  let allErrors: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        const result = processDirectory(fullPath);
        filesProcessed += result.files;
        totalRemoved += result.removed;
        allErrors.push(...result.errors);
      } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.js') || entry.endsWith('.jsx'))) {
        const result = processFile(fullPath);
        if (result.removed > 0) {
          filesProcessed++;
          totalRemoved += result.removed;
        }
        allErrors.push(...result.errors);
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }

  return { files: filesProcessed, removed: totalRemoved, errors: allErrors };
}

// Main execution
console.log('🧹 Safely removing console.log statements...\n');

let totalFiles = 0;
let totalRemoved = 0;
let allErrors: string[] = [];

SOURCE_DIRS.forEach(dir => {
  console.log(`Processing ${dir}/...`);
  const result = processDirectory(dir);
  console.log(`  ✅ ${result.files} files, ${result.removed} statements removed`);
  if (result.errors.length > 0) {
    console.log(`  ⚠️  ${result.errors.length} errors`);
  }
  totalFiles += result.files;
  totalRemoved += result.removed;
  allErrors.push(...result.errors);
});

console.log(`\n✨ Total: ${totalFiles} files processed, ${totalRemoved} console statements removed`);

if (allErrors.length > 0) {
  console.log(`\n⚠️  Errors encountered: ${allErrors.length}`);
  allErrors.forEach(err => console.log(`  - ${err}`));
}

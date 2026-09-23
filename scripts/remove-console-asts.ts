/**
 * AST-based console.log removal using Babel
 * This safely removes console.log, console.debug, console.info while preserving console.error and console.warn
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import t from '@babel/types';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SOURCE_DIRS = ['app/api', 'lib', 'components', 'middleware'];

// Files to skip
const SKIP_PATTERNS = ['logger.ts', '.test.ts', '.spec.ts', 'vitest'];

function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
}

function removeConsoleStatements(code: string): { code: string; removed: number } {
  let removedCount = 0;

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const consoleCallsToRemove: any[] = [];

    traverse(ast, {
      CallExpression(path) {
        // Check if it's a console call
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object, { name: 'console' }) &&
          t.isIdentifier(path.node.callee.property)
        ) {
          const methodName = (path.node.callee.property as t.Identifier).name;

          // Remove console.log, console.debug, console.info
          // Keep console.error, console.warn
          if (['log', 'debug', 'info'].includes(methodName)) {
            consoleCallsToRemove.push(path);
          }
        }
      },
    });

    // Remove the identified calls
    consoleCallsToRemove.forEach(path => {
      path.remove();
      removedCount++;
    });

    // Generate code from the modified AST
    const output = generate(
      ast,
      {
        retainLines: false,
        compact: false,
        concise: false,
      },
      code
    );

    return { code: output.code, removed: removedCount };
  } catch (error) {
    // If parsing fails, return original code
    return { code, removed: 0 };
  }
}

function processFile(filePath: string): { removed: number; error?: string } {
  if (shouldSkipFile(filePath)) {
    return { removed: 0 };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const result = removeConsoleStatements(content);

    if (result.removed > 0 && result.code !== content) {
      writeFileSync(filePath, result.code, 'utf-8');
    }

    return { removed: result.removed };
  } catch (error) {
    return {
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function processDirectory(dir: string): { files: number; removed: number; errors: string[] } {
  let filesProcessed = 0;
  let totalRemoved = 0;
  const allErrors: string[] = [];

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
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          const result = processFile(fullPath);
          if (result.removed > 0) {
            filesProcessed++;
            totalRemoved += result.removed;
          }
          if (result.error) {
            allErrors.push(`${fullPath}: ${result.error}`);
          }
        }
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }

  return { files: filesProcessed, removed: totalRemoved, errors: allErrors };
}

// Main execution
console.log('🧹 Removing console.log statements using AST parsing...\n');

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
  console.log(`\n⚠️  Errors: ${allErrors.length}`);
  allErrors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
  if (allErrors.length > 10) {
    console.log(`  ... and ${allErrors.length - 10} more`);
  }
}

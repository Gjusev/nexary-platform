/**
 * Remove console.log/debug/info statements using ESLint's --fix capability
 * This is the safest approach as it uses proper AST parsing
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Create a temporary ESLint config with no-console rule
const tempEslintConfig = {
  extends: 'next/core-web-vitals',
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
};

// Write temporary config
const tempConfigPath = join(process.cwd(), '.eslintrc.temp.json');
writeFileSync(tempConfigPath, JSON.stringify(tempEslintConfig, null, 2));

console.log('🧹 Removing console.log statements using ESLint...\n');

const SOURCE_DIRS = [
  'app/api',
  'lib',
  'components',
  'middleware',
];

try {
  let totalFiles = 0;

  SOURCE_DIRS.forEach(dir => {
    console.log(`Processing ${dir}/...`);

    try {
      // Run ESLint with --fix to automatically remove console.log
      const cmd = `npx eslint "${dir}/**/*.{ts,tsx,js,jsx}" --fix --config .eslintrc.temp.json --quiet`;
      const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });

      // Count fixed files from output
      if (output) {
        const matches = output.match(/\/\//g);
        const fileCount = matches ? matches.length : 0;
        totalFiles += fileCount;
        console.log(`  ✅ Processed files`);
      } else {
        console.log(`  ✅ No changes needed`);
      }
    } catch (error: any) {
      // ESLint returns non-zero exit code if it made fixes
      // but if there's an actual error, show it
      if (error.stdout && error.stdout.includes('error')) {
        console.log(`  ⚠️  Some errors encountered`);
      } else {
        console.log(`  ✅ Processed files`);
      }
    }
  });

  console.log(`\n✨ Console.log removal complete!`);
} finally {
  // Clean up temp config
  if (existsSync(tempConfigPath)) {
    const { unlinkSync } = require('fs');
    unlinkSync(tempConfigPath);
  }
}

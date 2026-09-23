#!/usr/bin/env node
/**
 * bun-migrate - Automated migration tool from npm to Bun
 * A reusable CLI tool for migrating any Node.js project to use Bun
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project type detection patterns
const PROJECT_TYPES = {
  'next-js': {
    name: 'Next.js',
    patterns: ['next.config.{js,mjs,ts}', 'app/**', 'pages/**'],
    dockerfilePatterns: ['FROM node:', 'npm install'],
    scripts: {
      dev: 'next dev',
      build: 'next build',
          start: 'next start',
      lint: 'next lint'
    }
  },
  react: {
    name: 'React',
    patterns: ['src/**', 'public/**', 'package.json'],
    dependencies: ['react', 'react-dom'],
    devDependencies: ['vite', '@vitejs/plugin-react', 'webpack']
  },
  'node-js': {
    name: 'Node.js',
    patterns: ['package.json', 'lib/**', 'src/**'],
    main: true
  },
  'nestjs': {
    name: 'NestJS',
    patterns: ['nest-cli.json', 'src/main.ts'],
    dependencies: ['@nestjs/common', '@nestjs/core']
  },
  express: {
    name: 'Express',
    patterns: ['package.json'],
    dependencies: ['express'],
    scripts: {
      start: 'node.*',
      dev: 'nodemon'
    }
  }
};

// Dependencies that may have issues with Bun
const PROBLEMATIC_DEPENDENCIES = [
  '@sentry/nextjs',
  '@next/swc-wasm-nodejs',
  'node-gyp',
  'electron'
];

class BunMigrator {
  constructor(projectPath = process.cwd(), options = {}) {
    this.projectPath = projectPath;
    this.options = {
      force: options.force || false,
      backup: options.backup !== false,
      skipDocker: options.skipDocker || false,
      ...options
    };
    this.diagnostics = {
      projectType: null,
      hasPackageLock: false,
      hasBunLock: false,
      hasDockerfile: false,
      issues: [],
      warnings: []
    };
  }

  async analyze() {
    const spinner = ora('Analyzing project structure...').start();

    try {
      // Check if package.json exists
      const pkgPath = path.join(this.projectPath, 'package.json');
      if (!await fs.pathExists(pkgPath)) {
        spinner.fail('No package.json found in current directory');
        return false;
      }

      this.packageJson = await fs.readJson(pkgPath);

      // Detect project type
      this.diagnostics.projectType = this.detectProjectType();

      // Check for lock files
      this.diagnostics.hasPackageLock = await fs.pathExists(
        path.join(this.projectPath, 'package-lock.json')
      );
      this.diagnostics.hasBunLock = await fs.pathExists(
        path.join(this.projectPath, 'bun.lockb')
      ) || await fs.pathExists(
        path.join(this.projectPath, 'bun.lock')
      );

      // Check for Dockerfile
      this.diagnostics.hasDockerfile = await fs.pathExists(
        path.join(this.projectPath, 'Dockerfile')
      );

      // Check for problematic dependencies
      const allDeps = {
        ...this.packageJson.dependencies,
        ...this.packageJson.devDependencies
      };

      for (const dep of PROBLEMATIC_DEPENDENCIES) {
        if (allDeps[dep]) {
          this.diagnostics.warnings.push(
            `Dependency ${dep} may have compatibility issues with Bun runtime`
          );
        }
      }

      spinner.succeed('Project analysis complete');
      return true;
    } catch (error) {
      spinner.fail(`Analysis failed: ${error.message}`);
      return false;
    }
  }

  detectProjectType() {
    for (const [type, config] of Object.entries(PROJECT_TYPES)) {
      if (config.patterns) {
        const matches = config.patterns.some(pattern =>
          fs.existsSync(path.join(this.projectPath, pattern.replace('**', '')))
        );
        if (matches) return type;
      }
    }

    // Check dependencies
    if (this.packageJson) {
      const allDeps = {
        ...this.packageJson.dependencies,
        ...this.packageJson.devDependencies
      };

      if (allDeps.next) return 'next-js';
      if (allDeps.react && allDeps.vite) return 'react';
      if (allDeps['@nestjs/common']) return 'nestjs';
      if (allDeps.express) return 'express';
    }

    return 'node-js';
  }

  async createBackup() {
    if (!this.options.backup) {
      return null;
    }

    const spinner = ora('Creating backup...').start();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.projectPath, `.bun-migrate-backup-${timestamp}`);

    try {
      const filesToBackup = [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'Dockerfile',
        'docker-compose.yml',
        'docker-compose.yaml',
        '.dockerignore'
      ];

      for (const file of filesToBackup) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          await fs.copy(filePath, path.join(backupDir, file));
        }
      }

      spinner.succeed(`Backup created at ${backupDir}`);
      return backupDir;
    } catch (error) {
      spinner.warn(`Backup creation failed: ${error.message}`);
      return null;
    }
  }

  async generateBunLock() {
    const spinner = ora('Generating bun.lock file...').start();

    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve, reject) => {
        const bun = spawn('bun', ['install'], {
          cwd: this.projectPath,
          stdio: 'pipe'
        });

        let output = '';
        let error = '';

        bun.stdout.on('data', (data) => {
          output += data.toString();
        });

        bun.stderr.on('data', (data) => {
          error += data.toString();
        });

        bun.on('close', (code) => {
          if (code === 0) {
            spinner.succeed('bun.lock file generated successfully');
            resolve(true);
          } else {
            spinner.fail(`Failed to generate bun.lock: ${error}`);
            reject(new Error(error));
          }
        });
      });
    } catch (error) {
      spinner.fail(`Bun installation failed: ${error.message}`);
      throw error;
    }
  }

  async updateDockerfile() {
    if (this.options.skipDocker || !this.diagnostics.hasDockerfile) {
      return null;
    }

    const spinner = ora('Optimizing Dockerfile for Bun...').start();
    const dockerfilePath = path.join(this.projectPath, 'Dockerfile');

    try {
      let content = await fs.readFile(dockerfilePath, 'utf-8');

      // Check if already optimized
      if (content.includes('oven/bun:')) {
        spinner.info('Dockerfile already optimized for Bun');
        return null;
      }

      // Create backup
      const backupPath = path.join(this.projectPath, 'Dockerfile.bak');
      await fs.copy(dockerfilePath, backupPath);

      // Generate optimized Dockerfile based on project type
      const optimizedDockerfile = this.generateDockerfile(content);

      await fs.writeFile(dockerfilePath, optimizedDockerfile);

      spinner.succeed('Dockerfile optimized for Bun (backup saved as Dockerfile.bak)');
      return backupPath;
    } catch (error) {
      spinner.warn(`Dockerfile optimization failed: ${error.message}`);
      return null;
    }
  }

  generateDockerfile(original) {
    const isNextJs = this.diagnostics.projectType === 'next-js';

    return `# Bun-optimized Dockerfile for ${PROJECT_TYPES[this.diagnostics.projectType].name}
# Generated by bun-migrate

# Install dependencies using Bun for faster installation
FROM oven/bun:1-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install dependencies using Bun (10-20x faster than npm)
# Support both bun.lockb and bun.lock
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --ignore-scripts && bun pm cache rm

# Rebuild the source code using Bun for faster build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

${isNextJs ? `# Build the application using Bun (faster than npm)
RUN bun run build

# Production image, use Node.js for maximum stability and compatibility
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/public ./public

# Set the correct permission for public directory
RUN chown -R nextjs:nodejs public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
WORKDIR /app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]` : `# Build the application using Bun
RUN bun run build

# Production with Node.js for stability
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
${this.diagnostics.projectType === 'nestjs' ? 'COPY --from=builder /app/package.json ./package.json' : ''}
EXPOSE 3000
CMD ["node", "dist/main.js"]`}
`;
  }

  async createNixpacksConfig() {
    const spinner = ora('Creating nixpacks.toml configuration...').start();
    const configPath = path.join(this.projectPath, 'nixpacks.toml');

    try {
      if (await fs.pathExists(configPath)) {
        spinner.info('nixpacks.toml already exists');
        return null;
      }

      const config = this.generateNixpacksConfig();
      await fs.writeFile(configPath, config);

      spinner.succeed('nixpacks.toml configuration created');
      return configPath;
    } catch (error) {
      spinner.warn(`Failed to create nixpacks.toml: ${error.message}`);
      return null;
    }
  }

  generateNixpacksConfig() {
    const isNextJs = this.diagnostics.projectType === 'next-js';

    return `# Nixpacks Configuration for ${PROJECT_TYPES[this.diagnostics.projectType].name}
# This file configures how Nixpacks builds your application
# Used by Railway, CodeSandbox, Replit, and other platforms

[phases.build]
# Build command - Nixpacks detects bun.lock and uses Bun automatically
cmds = ["bun run build"]

[phases.start]
${isNextJs ? `# Start command - Use Node.js for production stability
cmd = "node .next/standalone${this.packageJson.name || '/app'}/server.js"` : `# Start command
cmd = "bun run start"`}

# Environment variables during build
[variables]
NODE_ENV = "production"
PORT = "3000"
NEXT_TELEMETRY_DISABLED = "1"

# Health check configuration
[healthcheck]
path = "/health"
timeout = 300
interval = 60
restart_limit = 10
`;
  }

  async createReadme() {
    const spinner = ora('Creating migration documentation...').start();
    const readmePath = path.join(this.projectPath, 'BUN_MIGRATION.md');

    try {
      if (await fs.pathExists(readmePath) && !this.options.force) {
        spinner.info('BUN_MIGRATION.md already exists (use --force to overwrite)');
        return null;
      }

      const content = this.generateReadme();
      await fs.writeFile(readmePath, content);

      spinner.succeed('BUN_MIGRATION.md documentation created');
      return readmePath;
    } catch (error) {
      spinner.warn(`Failed to create documentation: ${error.message}`);
      return null;
    }
  }

  generateReadme() {
    const projectName = this.packageJson.name || 'this project';
    const projectType = PROJECT_TYPES[this.diagnostics.projectType].name;

    return `# Bun Migration Guide for ${projectName}

This document describes the migration from npm to Bun for ${projectName}.

## Migration Date

${new Date().toISOString()}

## Project Type

${projectType}

## What Was Done

### 1. Bun Lock File Generated
- Converted \`package-lock.json\` to \`bun.lock\`
- Faster dependency installation (10-20x speedup)

### 2. Dockerfile Optimized
- Multi-stage build using Bun for dependency installation
- Bun for faster build times
- Node.js for production stability
- Backup saved as \`Dockerfile.bak\`

### 3. Nixpacks Configuration
- Created \`nixpacks.toml\` for deployment platforms
- Automatic Bun detection
- Optimized for Railway, Render, and other platforms

## How to Use

### Development

\`\`\`bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run tests
bun run test

# Build for production
bun run build
\`\`\`

### Production Deployment

\`\`\`bash
# Build with Bun
bun run build

# Start production server (use Node.js for stability)
node .next/standalone/server.js  # Next.js
# OR
node dist/main.js  # NestJS/Express
\`\`\`

## Performance Improvements

- **Installation**: 10-20x faster than npm
- **Memory Usage**: 20-30% less during development
- **Build Time**: Slightly faster (varies by project)

## Important Notes

1. **Use Bun as package manager**, not as runtime for production
2. **Node.js is still used** for production deployment
3. Some dependencies may have compatibility issues - monitor for any issues
4. Rollback is possible using the backup files created during migration

## Rollback

If you need to rollback:

1. Restore from backup directory:
   \`\`\`bash
   cp .bun-migrate-backup-*/package-lock.json .
   cp .bun-migrate-backup-*/Dockerfile.bak Dockerfile
   \`\`\`

2. Remove Bun lock files:
   \`\`\`bash
   rm -f bun.lock bun.lockb
   \`\`\`

3. Reinstall with npm:
   \`\`\`bash
   npm install
   \`\`\`

## Learn More

- [Bun Documentation](https://bun.sh/docs)
- [Bun for Next.js](https://bun.sh/guides/ecosystem/nextjs)
- [Nixpacks Documentation](https://nixpacks.com/docs)

---
Generated by [bun-migrate](https://github.com/yourusername/bun-migrate)
`;
  }

  async migrate() {
    console.log(chalk.bold.cyan('\n🚀 Starting Bun Migration\n'));

    // Analyze project
    const analyzed = await this.analyze();
    if (!analyzed) {
      console.error(chalk.red('Failed to analyze project'));
      return false;
    }

    // Display diagnostics
    this.displayDiagnostics();

    // Check for issues
    if (this.diagnostics.issues.length > 0 && !this.options.force) {
      console.log(chalk.yellow('\n⚠️  Issues detected. Use --force to proceed anyway.\n'));
      return false;
    }

    // Create backup
    const backupDir = await this.createBackup();

    // Generate bun.lock
    await this.generateBunLock();

    // Update Dockerfile
    await this.updateDockerfile();

    // Create nixpacks config
    await this.createNixpacksConfig();

    // Create documentation
    await this.createReadme();

    // Summary
    this.displaySummary(backupDir);

    return true;
  }

  displayDiagnostics() {
    console.log(chalk.bold('📊 Project Diagnostics:\n'));
    console.log(`   Project Type: ${chalk.cyan(PROJECT_TYPES[this.diagnostics.projectType].name)}`);
    console.log(`   Package Manager: ${chalk.yellow(this.diagnostics.hasBunLock ? 'Bun (already migrated)' : 'npm')}`);
    console.log(`   Dockerfile: ${this.diagnostics.hasDockerfile ? chalk.green('✓') : chalk.gray('✗')}`);
    console.log(`   Lock Files: ${this.diagnostics.hasPackageLock ? chalk.green('package-lock.json') : ''} ${this.diagnostics.hasBunLock ? chalk.green('bun.lock') : ''}`);

    if (this.diagnostics.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      this.diagnostics.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }

    console.log();
  }

  displaySummary(backupDir) {
    console.log(chalk.bold.green('\n✨ Migration Complete!\n'));

    const changes = [
      { name: 'bun.lock file', status: true },
      { name: 'Dockerfile optimization', status: this.diagnostics.hasDockerfile && !this.options.skipDocker },
      { name: 'Nixpacks configuration', status: true },
      { name: 'Migration documentation', status: true },
      { name: 'Backup created', status: backupDir !== null }
    ];

    changes.forEach(change => {
      console.log(`   ${change.status ? chalk.green('✓') : chalk.gray('○')} ${change.name}`);
    });

    if (backupDir) {
      console.log(chalk.cyan(`\n📦 Backup: ${backupDir}`));
    }

    console.log(chalk.bold('\n📝 Next Steps:\n'));
    console.log('   1. Review the changes made');
    console.log('   2. Test your development environment:');
    console.log(chalk.cyan('      bun run dev'));
    console.log('   3. Build for production:');
    console.log(chalk.cyan('      bun run build'));
    console.log('   4. Read BUN_MIGRATION.md for deployment instructions');
    console.log();
  }
}

// CLI Program
const program = new Command();

program
  .name('bun-migrate')
  .description('Automated migration tool from npm to Bun')
  .version('1.0.0');

program
  .command('migrate')
  .description('Migrate current project to use Bun')
  .option('-f, --force', 'Force migration even if issues are detected')
  .option('--no-backup', 'Skip creating backup')
  .option('--skip-docker', 'Skip Dockerfile optimization')
  .option('-p, --path <path>', 'Path to project directory', process.cwd())
  .action(async (options) => {
    const migrator = new BunMigrator(options.path, options);
    const success = await migrator.migrate();
    process.exit(success ? 0 : 1);
  });

program
  .command('analyze')
  .description('Analyze project for Bun compatibility')
  .option('-p, --path <path>', 'Path to project directory', process.cwd())
  .action(async (options) => {
    const migrator = new BunMigrator(options.path);
    await migrator.analyze();
    migrator.displayDiagnostics();
  });

program
  .command('lock')
  .description('Generate bun.lock from package-lock.json')
  .option('-p, --path <path>', 'Path to project directory', process.cwd())
  .action(async (options) => {
    const migrator = new BunMigrator(options.path);
    await migrator.analyze();
    await migrator.generateBunLock();
  });

program
  .command('docker')
  .description('Optimize Dockerfile for Bun')
  .option('-p, --path <path>', 'Path to project directory', process.cwd())
  .action(async (options) => {
    const migrator = new BunMigrator(options.path, { skipDocker: false });
    await migrator.analyze();
    await migrator.updateDockerfile();
  });

program
  .command('nixpacks')
  .description('Create nixpacks.toml configuration')
  .option('-p, --path <path>', 'Path to project directory', process.cwd())
  .action(async (options) => {
    const migrator = new BunMigrator(options.path);
    await migrator.analyze();
    await migrator.createNixpacksConfig();
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

# Bun Optimization Guide for Nexary

## Current Compatibility Status (January 2025)

### ✅ What Works with Bun
- **Package Manager**: Bun can be used as a fast package manager for installing dependencies
- **Development Server**: Can run `bun run dev` for faster startup during development
- **Script Execution**: Can run scripts and build tools efficiently

### ⚠️ Known Limitations
- **Runtime Compatibility**: Next.js 15 uses Node APIs that aren't fully compatible with Bun's runtime
- **Meta Tag Issues**: Using Bun as the production runtime can cause meta tags to appear in the page body
- **Build Edge Cases**: Some users encounter build errors with Next.js 15 + Bun combinations

### 🎯 Recommended Approach

## 1. Use Bun as Package Manager (Recommended)

### Benefits
- **10-20x faster** package installation than npm
- **Faster** script execution during development
- **Drop-in replacement** for npm commands

### How to Use

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies with Bun
bun install

# Run development server
bun run dev

# Run tests
bun run test

# Type checking
bun run typecheck

# Build for production
bun run build
```

### Update package.json Scripts

You can optionally update scripts in `package.json` to explicitly use Bun:

```json
{
  "scripts": {
    "dev": "bun next dev",
    "build": "bun next build",
    "start": "bun next start",
    "lint": "bun next lint",
    "typecheck": "bun tsc --noEmit"
  }
}
```

## 2. Production Deployment Recommendations

### ✅ Use Node.js for Production

**For production deployments, continue using Node.js as the runtime** to ensure full compatibility with Next.js 15 features:

```bash
# Production build (can use Bun for building)
bun run build

# Production start (use Node.js for runtime)
node .next/standalone/server.js
# OR if using PM2:
pm2 start .next/standalone/server.js --name nexary
```

### Why Not Bun in Production?

1. **Meta Tag Issues**: Known bugs with Next.js 15.4+ causing incorrect meta tag placement
2. **Node API Dependencies**: Next.js relies on Node-specific APIs (crypto, fs, net) that have compatibility issues with Bun
3. **Vercel Compatibility**: Vercel's platform is optimized for Node.js runtime
4. **Stability**: Node.js has been battle-tested with Next.js for years

## 3. Development Workflow Optimization

### Recommended Development Setup

```bash
# Install dependencies
bun install

# Development with hot reload
bun run dev

# Run type checking in watch mode
bun run typecheck --watch

# Run tests
bun run test:ui

# Check for missing dependencies
bun run deps:check
```

### Benefits of This Approach
- **Faster iteration** during development with Bun's speed
- **Production safety** with Node.js runtime
- **Best of both worlds** without compatibility risks

## 4. Project-Specific Considerations

### Dependencies That May Have Issues

Based on `package.json` analysis, these dependencies require special attention:

1. **`pdf-parse`** - Native Node module, marked as `serverExternalPackages`
   - ✅ Works with Bun (mostly compatible)
   - ⚠️ May need testing for edge cases

2. **`ioredis`** - Redis client
   - ✅ Works with Bun
   - ⚠️ Test connection pooling behavior

3. **`pg`** - PostgreSQL client
   - ✅ Works with Bun
   - ⚠️ Verify connection handling in production

4. **`@sentry/nextjs`** - Error tracking
   - ⚠️ May have compatibility issues with Bun runtime
   - ✅ Works fine when using Bun as package manager only

5. **`pino`** - Structured logging
   - ✅ Works with Bun
   - ⚠️ Test pino-pretty formatting

6. **`@next/swc-wasm-nodejs`** - WASM bindings
   - ⚠️ May have issues with Bun's WASM support
   - Consider using native SWC instead

### Recommended Testing Strategy

```bash
# 1. Test development workflow
bun install
bun run dev

# 2. Test build process
bun run build

# 3. Test production startup with Node.js
node .next/standalone/server.js

# 4. Test critical functionality
# - Chat streaming
# - File uploads (PDF, DOCX, etc.)
# - Database connections
# - Redis caching
# - Sentry error tracking
```

## 5. Performance Benchmarks

### Expected Performance Improvements

| Operation | npm | Bun | Improvement |
|-----------|-----|-----|-------------|
| Initial install | ~45s | ~4s | **11x faster** |
| Subsequent installs | ~10s | ~1s | **10x faster** |
| Dev server start | ~3s | ~2s | **1.5x faster** |
| Type checking | ~8s | ~6s | **1.3x faster** |
| Build time | ~60s | ~58s | Minimal difference |

### Memory Usage
- **Bun**: Typically uses 20-30% less memory during development
- **Node.js**: More consistent memory usage in production

## 6. Migration Steps

### Step 1: Install Bun
```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
irm bun.sh/install.ps1 | iex
```

### Step 2: Migrate Lock File
```bash
# Convert package-lock.json to bun.lockb
bun install

# Commit the new bun.lockb
git add bun.lockb
git commit -m "chore: Add Bun lock file"
```

### Step 3: Update CI/CD

Update your CI/CD pipeline to use Bun for builds:

```yaml
# Example for GitHub Actions
- name: Install Bun
  uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest

- name: Install dependencies
  run: bun install

- name: Build application
  run: bun run build

- name: Start production server
  run: node .next/standalone/server.js  # Use Node.js for runtime
```

### Step 4: Update Dockerfile (if using Docker)

The Dockerfile has already been optimized for Bun. Key changes:

```dockerfile
# Install dependencies using Bun for faster installation
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --ignore-scripts && bun pm cache rm

# Build with Bun
FROM oven/bun:1-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production with Node.js for stability
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
# Set working directory to projectNexus
WORKDIR /app/projectNexus
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

**Before building with Docker, generate bun.lockb:**

```bash
# Install Bun locally first
curl -fsSL https://bun.sh/install | bash

# Generate bun.lockb from existing package-lock.json
bun install

# Commit the lock file
git add bun.lockb
git commit -m "chore: Add Bun lock file"

# Now build with Docker
docker-compose build
```

### Step 5: Build and Run with Docker

```bash
# Build the optimized Docker image
docker-compose -f docker-compose.private-cloud.yml build

# Start all services
docker-compose -f docker-compose.private-cloud.yml up -d

# View logs
docker-compose -f docker-compose.private-cloud.yml logs -f nexary-app

# Stop services
docker-compose -f docker-compose.private-cloud.yml down
```

## 7. Monitoring and Validation

### Key Metrics to Monitor

After migrating to Bun for development, monitor:

1. **Installation Time**: Should be significantly faster
2. **Dev Server Startup**: Should be slightly faster
3. **Build Time**: Should be similar or slightly faster
4. **Error Rates**: Should remain unchanged
5. **Runtime Errors**: Should not increase in production

### Validation Checklist

- [ ] All dependencies install without errors
- [ ] Development server starts correctly
- [ ] Hot reloading works as expected
- [ ] Type checking completes successfully
- [ ] Tests pass without modification
- [ ] Production build completes successfully
- [ ] Production server starts with Node.js
- [ ] All features work correctly (chat, uploads, etc.)
- [ ] Error tracking (Sentry) works correctly
- [ ] Logging functions properly
- [ ] Database connections are stable
- [ ] Redis caching works as expected

## 8. Troubleshooting

### Common Issues and Solutions

#### Issue: Build fails with Bun
**Solution**: Use Node.js for production builds
```bash
node_modules/.bin/next build
```

#### Issue: Native modules don't work
**Solution**: Rebuild native modules for Bun
```bash
bun rebuild
```

#### Issue: Meta tags in wrong place
**Solution**: Use Node.js for production runtime (not Bun)
```bash
node .next/standalone/server.js
```

#### Issue: Performance regression
**Solution**: Revert to npm for that specific operation
```bash
npm run build  # Instead of bun run build
```

## 9. Conclusion

### Recommended Strategy
- **Development**: Use Bun for faster iteration and package management
- **Production**: Use Node.js for stability and full Next.js 15 compatibility
- **CI/CD**: Use Bun for faster builds, deploy with Node.js runtime

### Expected Benefits
- **10-20x faster** dependency installation
- **20-30% less** memory usage during development
- **Faster** iteration cycles with hot reload
- **No production risk** by keeping Node.js runtime

### References
- [Bun Next.js Guide](https://bun.com/docs/guides/ecosystem/nextjs)
- [Next.js Bun Runtime Discussion](https://github.com/vercel/next.js/discussions/55272)
- [Bun vs Node.js 2025 Comparison](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide)

---

**Last Updated**: January 8, 2026

**Note**: Bun and Next.js compatibility is actively evolving. Check the latest documentation for updates.

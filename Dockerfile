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

# Build the application using Bun (faster than npm)
# The .env.local file is copied during the earlier COPY step so the values stay in sync.
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
# Keep env values available at runtime (Next loads .env.* on start)
# COPY --from=builder --chown=nextjs:nodejs /app/.env.local ./.env.local

USER nextjs

# Set working directory to projectNexus
WORKDIR /app/projectNexus

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

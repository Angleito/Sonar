# Stage 1: Build
FROM oven/bun:1-slim as builder

WORKDIR /app

# Copy root package.json and workspace packages
COPY package.json bun.lock ./
COPY packages ./packages
COPY backend ./backend

# Install dependencies
RUN bun install --production

# Stage 2: Runtime
FROM oven/bun:1-slim

WORKDIR /app

# Copy built dependencies and source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY backend ./backend

# Create directory for Prisma
RUN mkdir -p backend/.prisma

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run --eval "const response = await fetch('http://localhost:3001/health'); process.exit(response.ok ? 0 : 1);"

# Run backend
CMD ["bun", "run", "backend/src/index.ts"]

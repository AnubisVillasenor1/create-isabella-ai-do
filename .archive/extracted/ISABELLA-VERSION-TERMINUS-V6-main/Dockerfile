# Dockerfile for ISABELLA GENESIS ZERO-OPEX v3
# Multi-stage build for minimal production image

# Stage 1: Base with dependencies
FROM node:24-alpine AS base
RUN apk add --no-cache \
    postgresql-client \
    curl \
    dumb-init \
    tini \
    && npm install -g pnpm@10.28.0

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 3: Builder
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:dist

# Stage 4: Production
FROM node:24-alpine AS production
RUN apk add --no-cache \
    postgresql-client \
    curl \
    dumb-init \
    tini \
    && addgroup -g 10001 -S isabella \
    && adduser -u 10001 -S isabella -G isabella

WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/config ./config
COPY --from=build /app/src/ui ./src/ui
COPY --from=build /app/src/styles ./src/styles
COPY --from=build /app/src/assets ./src/assets

# Create required directories
RUN mkdir -p /app/logs /app/data /app/uploads && \
    chown -R isabella:isabella /app

USER 10001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

# Environment
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Entry point with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["dist/server.js"]

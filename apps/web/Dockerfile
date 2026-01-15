# Dockerfile for Web frontend (Railway deployment)
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy web app package.json
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @dbx/web...

# Copy web source code
COPY apps/web/ ./apps/web/

# Build the application
WORKDIR /app/apps/web
RUN pnpm run build

# Production stage - serve static files
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy startup script
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set default PORT (Railway will override this)
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]

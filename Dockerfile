# Multi-stage Dockerfile for DBX Studio Monorepo
# Builds both API and Web, runs them together

FROM oven/bun:latest AS base

# Install Node.js and pnpm for the web app
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g pnpm

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all app directories
COPY apps ./apps

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build web app
WORKDIR /app/apps/web
RUN pnpm run build

# Go back to root
WORKDIR /app

# Expose ports
EXPOSE 3000 3002

# Create startup script
RUN echo '#!/bin/bash\n\
cd /app/apps/api && bun run src/index.ts &\n\
cd /app/apps/web && pnpm start &\n\
wait' > /app/start.sh && chmod +x /app/start.sh

# Start both services
CMD ["/app/start.sh"]

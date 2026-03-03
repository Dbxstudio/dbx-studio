# Dockerfile for DBX Studio Monorepo
# Builds both API and Web, and runs them via Nginx

FROM oven/bun:latest

# Install Node.js, pnpm, and nginx
RUN apt-get update && apt-get install -y curl nginx && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all directories containing code
COPY apps ./apps
COPY packages ./packages

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Build web app
# Building the web app puts static assets into apps/web/dist
RUN cd apps/web && pnpm run build

# Setup volumes for database/state if needed
RUN mkdir -p /app/apps/api/data && chmod 777 /app/apps/api/data
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port (Nginx handles both Web and API over 8080)
EXPOSE 8080

# Create startup script: Start API and Nginx
RUN echo '#!/bin/bash\n\
    # Start API in background\n\
    # Ensure backend listens closely to the required PORT\n\
    export PORT=3002\n\
    cd /app/apps/api && bun run src/index.ts &\n\
    \n\
    # Wait a moment for API to start\n\
    sleep 2\n\
    \n\
    # Start nginx in foreground\n\
    nginx -g "daemon off;"' > /app/start.sh && chmod +x /app/start.sh

# Start all services
CMD ["/app/start.sh"]

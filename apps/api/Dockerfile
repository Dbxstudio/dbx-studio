# Dockerfile for API only (Railway deployment)
FROM oven/bun:latest

WORKDIR /app

# Install pnpm standalone (doesn't require npm)
RUN curl -fsSL https://get.pnpm.io/install.sh | ENV="/.bashrc" SHELL="$(which sh)" sh - && \
    ln -s /root/.local/share/pnpm/pnpm /usr/local/bin/pnpm || \
    (curl -fsSL -o /usr/local/bin/pnpm https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64 && chmod +x /usr/local/bin/pnpm)

# Copy only API directory
COPY apps/api/package.json apps/api/bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy API source code
COPY apps/api/ ./

# Create data directory for PGlite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Set default PORT (Railway will override this)
ENV PORT=3002

# Disable Corepack to prevent pnpm/yarn lookups at runtime
ENV COREPACK_ENABLE_STRICT=0 \
    COREPACK_ENABLE_AUTO_PIN=0

# Expose port
EXPOSE 3002

# Copy and set permissions for startup script
COPY apps/api/start.sh ./start.sh
RUN chmod +x ./start.sh

# Health check - use PORT env var
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || '3002') + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start the API with startup script
CMD ["./start.sh"]

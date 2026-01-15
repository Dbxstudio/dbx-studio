#!/bin/bash

echo "=== Starting DBX Studio API ==="
echo "PORT: ${PORT:-3002}"
echo "NODE_ENV: ${NODE_ENV:-development}"
echo "Working directory: $(pwd)"
echo "Files in current directory:"
ls -la

echo ""
echo "=== Starting Bun server ==="
bun run src/index.ts &

# Wait for server to start
sleep 3

# Test if server is responding
echo ""
echo "=== Testing server health ==="
curl -f http://localhost:${PORT:-3002}/api/health || echo "Health check failed!"

# Keep the container running
wait

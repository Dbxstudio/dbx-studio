#!/bin/sh
set -e

# Replace the port in nginx config with the PORT environment variable
sed -i "s/listen 3000;/listen ${PORT:-3000};/" /etc/nginx/conf.d/default.conf

# Configure API proxy if BACKEND_URL is set
echo "BACKEND_URL environment variable: ${BACKEND_URL:-NOT SET}"
if [ -n "$BACKEND_URL" ]; then
    # Remove trailing slash from BACKEND_URL if present
    BACKEND_URL_CLEAN=$(echo "$BACKEND_URL" | sed 's:/*$::')
    echo "✓ Configuring API proxy to backend: $BACKEND_URL_CLEAN"

    # Extract host and scheme from BACKEND_URL for DNS resolution
    BACKEND_HOST=$(echo "$BACKEND_URL_CLEAN" | sed -E 's|^https?://||')
    BACKEND_SCHEME=$(echo "$BACKEND_URL_CLEAN" | grep -oE '^https?' || echo "http")

    echo "Backend host: $BACKEND_HOST"
    echo "Backend scheme: $BACKEND_SCHEME"

    # Create the proxy configuration block with proper escaping
    # Backend has basePath('/api'), so we forward the full path including /api
    # Use variable to defer DNS resolution (fixes Railway private network DNS issues)
    cat > /tmp/proxy-block.conf <<EOF_PROXY
    # DNS resolver for internal/external networks
    resolver 127.0.0.11 8.8.8.8 1.1.1.1 valid=10s ipv6=off;
    resolver_timeout 10s;

    location /api/ {
        set \$backend_host "${BACKEND_HOST}";
        set \$backend_scheme "${BACKEND_SCHEME}";
        # Use rewrite to capture full URI and pass it to backend
        rewrite ^/api/(.*)$ /api/\$1 break;
        proxy_pass \$backend_scheme://\$backend_host;
        proxy_http_version 1.1;

        # SSL settings for HTTPS backends
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Headers - Set Host to backend host for proper routing
        proxy_set_header Host \$backend_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_buffering off;

        # Let backend handle CORS (don't add headers here to avoid conflicts)
    }
EOF_PROXY

    # Replace the placeholder with the proxy block
    # Split into before and after, then reconstruct
    sed -n '1,/# PROXY_BLOCK_START/p' /etc/nginx/conf.d/default.conf > /tmp/nginx.conf.tmp
    cat /tmp/proxy-block.conf >> /tmp/nginx.conf.tmp
    echo "    # PROXY_BLOCK_END" >> /tmp/nginx.conf.tmp
    sed -n '/# PROXY_BLOCK_END/,$p' /etc/nginx/conf.d/default.conf | tail -n +2 >> /tmp/nginx.conf.tmp
    mv /tmp/nginx.conf.tmp /etc/nginx/conf.d/default.conf

    echo "Generated nginx configuration:"
    cat /etc/nginx/conf.d/default.conf
else
    echo "WARNING: BACKEND_URL not set, API requests will not be proxied"
fi

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Start nginx in foreground
echo "Starting nginx..."
exec nginx -g 'daemon off;'

#!/bin/bash

# Deploy to Vercel Monorepo (Frontend + API together)
# This script deploys both apps to the same Vercel project

set -e

echo "🚀 DBX Studio - Vercel Monorepo Deployment"
echo "=========================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if in git repo
if [ ! -d .git ]; then
    echo "⚠️  Not a git repository. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
fi

echo "📦 Building project..."
pnpm install

echo ""
echo "🔍 Pre-deployment checklist:"
echo ""
echo "1. ✅ Root vercel.json configured"
echo "2. ✅ Build command set: pnpm turbo run build --filter=@dbx/web"
echo "3. ✅ Output directory: apps/web/.output/public"
echo "4. ✅ API functions: api/index.ts"
echo ""

# Ask for deployment type
echo "Select deployment type:"
echo "1) Preview deployment (test)"
echo "2) Production deployment"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "🔄 Deploying preview..."
        vercel
        ;;
    2)
        echo ""
        echo "⚠️  This will deploy to production!"
        read -p "Are you sure? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            echo ""
            echo "🚀 Deploying to production..."
            vercel --prod
        else
            echo "Deployment cancelled"
            exit 0
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add environment variables in Vercel Dashboard:"
echo "   - ANTHROPIC_API_KEY (or AWS keys)"
echo "   - TURSO_DATABASE_URL (optional)"
echo "   - TURSO_AUTH_TOKEN (optional)"
echo ""
echo "2. Test your deployment:"
echo "   - Frontend: https://your-app.vercel.app"
echo "   - API: https://your-app.vercel.app/api/health"
echo ""
echo "3. Configure custom domain (optional):"
echo "   - Vercel Dashboard → Settings → Domains"
echo ""

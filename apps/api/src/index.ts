import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { timing } from 'hono/timing'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import consola from 'consola'

// Import database
import { initializeDatabase } from './drizzle'

// Import routes
import { healthRoutes } from './routes/health'
import { aiStreamRoutes } from './routes/ai-stream'
import { createContext } from './orpc/context'
import { router } from './orpc/routers'

// Initialize unified PGLite database (includes AI tables)
await initializeDatabase()

// Create oRPC handler
const rpcHandler = new RPCHandler(router, {
    interceptors: [
        onError((error) => {
            consola.error('oRPC Error:', error)
            // Log detailed validation errors
            if (error && typeof error === 'object' && 'message' in error) {
                const err = error as { message?: string; issues?: unknown[] }
                if (err.message?.includes('validation')) {
                    consola.error('Validation error details:', JSON.stringify(error, null, 2))
                }
            }
        }),
    ],
})

// Create Hono app with base path
const app = new Hono().basePath('/api')

// Global middleware
app.use('*', logger())
app.use('*', timing())
app.use('*', prettyJSON())
app.use('*', secureHeaders())
app.use('*', cors({
    origin: (origin) => {
        // Same-origin requests (no origin header) - return '*' to allow
        if (!origin) return '*'

        // Allow localhost for development
        if (origin?.includes('localhost')) return origin

        // Allow Vercel deployments
        if (origin?.includes('vercel.app')) return origin

        // Allow AWS App Runner deployments
        if (origin?.includes('awsapprunner.com')) return origin

        // Allow Railway deployments
        if (origin?.includes('railway.app')) return origin

        // Allow specific origins from environment variable
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []
        if (allowedOrigins.includes(origin)) return origin

        // Allow your custom domain (add yours here if you have one)
        // if (origin === 'https://yourdomain.com') return origin

        // Log rejected origins for debugging
        consola.warn('CORS: Rejecting origin:', origin)

        // Default: allow the origin for same-domain deployments
        return origin
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

// Mount health routes
app.route('/health', healthRoutes)

// Mount AI streaming routes
app.route('/ai', aiStreamRoutes)

// Mount oRPC handler
app.use('/rpc/*', async (c, next) => {
    const { matched, response } = await rpcHandler.handle(c.req.raw, {
        prefix: '/api/rpc',
        context: createContext(c),
    })

    if (matched) {
        return c.newResponse(response.body, response)
    }

    await next()
})

// Root endpoint
app.get('/', (c) => {
    return c.json({
        name: 'DBX Studio API',
        version: '0.0.1',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            rpc: '/api/rpc',
        },
    })
})

// Error handling
app.onError((err, c) => {
    consola.error('API Error:', err.message)
    return c.json({
        success: false,
        error: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    }, 500)
})

// 404 handler
app.notFound((c) => {
    return c.json({
        success: false,
        error: 'Not Found',
        path: c.req.path,
    }, 404)
})

// Start server using Bun's native server
const port = parseInt(process.env.PORT || '3002', 10)

// Log startup info for debugging
console.log('=== Server Configuration ===')
console.log('PORT from env:', process.env.PORT)
console.log('Resolved port:', port)
console.log('Binding to: 0.0.0.0')
console.log('Environment:', process.env.NODE_ENV || 'development')
console.log('============================')

consola.box({
    title: '🚀 DBX Studio API',
    message: [
        `Server running at http://localhost:${port}`,
        '',
        '📦 Features:',
        '  • PGLite unified database (connections, queries, AI tables)',
        '  • Kysely SQL builder for external databases',
        '  • oRPC type-safe API routes',
        '  • Multi-provider AI (DBX, Bedrock, OpenAI, Claude)',
        '  • AI memory system (STM + LTM)',
        '  • Think mode with reasoning',
        '',
        '🔗 Endpoints:',
        `  • Health:  http://localhost:${port}/api/health`,
        `  • AI:      http://localhost:${port}/api/ai`,
        `  • RPC:     http://localhost:${port}/api/rpc`,
    ].join('\n'),
    style: {
        borderColor: 'cyan',
    },
})

export default {
    port,
    hostname: '0.0.0.0', // Bind to all interfaces for Docker/Railway
    fetch: app.fetch,
    // Increase idle timeout for AI agent SSE streams that need multiple iterations
    // Default is 10 seconds, but AI workflows can take longer
    idleTimeout: 120, // 2 minutes - enough for multi-iteration AI agent loops
}

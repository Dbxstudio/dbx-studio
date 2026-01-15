// Vercel serverless function entry point
// This file wraps the Hono app for Vercel deployment

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { timing } from 'hono/timing'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'

// Import database
import { initializeDatabase } from '../apps/api/src/drizzle'

// Import routes
import { healthRoutes } from '../apps/api/src/routes/health'
import { aiStreamRoutes } from '../apps/api/src/routes/ai-stream'
import { createContext } from '../apps/api/src/orpc/context'
import { router } from '../apps/api/src/orpc/routers'

// Create oRPC handler
const rpcHandler = new RPCHandler(router, {
    interceptors: [
        onError((error) => {
            console.error('oRPC Error:', error)
            if (error && typeof error === 'object' && 'message' in error) {
                const err = error as { message?: string; issues?: unknown[] }
                if (err.message?.includes('validation')) {
                    console.error('Validation error details:', JSON.stringify(error, null, 2))
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
        if (origin?.includes('localhost')) return origin
        if (origin?.includes('vercel.app')) return origin
        return 'http://localhost:5174'
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
    console.error('API Error:', err.message)
    return c.json({
        success: false,
        error: err.message,
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

// Initialize database on first request (lazy initialization)
let dbInitialized = false
async function ensureDbInitialized() {
    if (!dbInitialized) {
        await initializeDatabase()
        dbInitialized = true
    }
}

// Wrap the fetch handler to ensure DB is initialized
export default {
    async fetch(request: Request, env: any, ctx: any) {
        await ensureDbInitialized()
        return app.fetch(request, env, ctx)
    }
}

import { Hono } from 'hono'

export const healthRoutes = new Hono()

// Basic health check
healthRoutes.get('/', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    })
})

// Detailed health check
healthRoutes.get('/details', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        runtime: {
            bun: Bun.version,
            memory: process.memoryUsage(),
        },
        features: {
            postgresql: true,
            mysql: true,
            mssql: true,
            clickhouse: true,
            snowflake: true,
        },
    })
})

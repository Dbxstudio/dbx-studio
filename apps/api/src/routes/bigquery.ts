import { Hono } from 'hono'
import { z } from 'zod'
import { createTempBigQueryConnection, bigQueryConnect } from '../kysely/bigquery'

const testConnectionSchema = z.object({
    projectId: z.string().min(1, 'projectId is required'),
    keyFilename: z.string().min(1, 'keyFilename is required'),
    dataset: z.string().optional(),
})

export const bigQueryRoutes = new Hono()

bigQueryRoutes.post('/test-connection', async (c) => {
    const start = Date.now()

    try {
        const body = await c.req.json()
        const input = testConnectionSchema.parse(body)

        const client = createTempBigQueryConnection({
            projectId: input.projectId,
            keyFilename: input.keyFilename,
            dataset: input.dataset,
        })

        await bigQueryConnect(client)

        return c.json({
            success: true,
            message: 'BigQuery connection successful',
            latency: Date.now() - start,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'BigQuery connection failed'

        return c.json({
            success: false,
            error: message,
            latency: Date.now() - start,
        }, 400)
    }
})

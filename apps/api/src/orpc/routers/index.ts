import type { RouterClient } from '@orpc/server'
import { connectionsRouter } from './connections'
import { tablesRouter } from './tables'
import { queriesRouter } from './queries'
import { authRouter } from './auth'
import { aiRouter, chatRouter } from './ai'

// Main router combining all sub-routers
export const router = {
    auth: authRouter,
    connections: connectionsRouter,
    tables: tablesRouter,
    queries: queriesRouter,
    ai: aiRouter,
    chat: chatRouter, // Phase 5: AI Chat routes
}

// Type export for client usage
export type ORPCRouter = RouterClient<typeof router>


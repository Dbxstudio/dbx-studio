import type { Context } from './context'
import { ORPCError, os } from '@orpc/server'
import { db } from '../drizzle'

// Create oRPC instance with context
export const orpc = os.$context<Context>()

// Error types
export { ORPCError }

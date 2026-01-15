import type { Context as HonoContext } from 'hono'
import { db } from '../drizzle'

export interface Context {
    headers: Headers
    db: typeof db
}

export function createContext(c: HonoContext): Context {
    return {
        headers: c.req.raw.headers,
        db,
    }
}

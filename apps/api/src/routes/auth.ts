/**
 * REST API endpoints for authentication
 * Wraps the oRPC auth router for compatibility with direct HTTP requests
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { ORPCError } from '~/orpc'
import { db } from '~/drizzle'
import { nanoid } from 'nanoid'

const app = new Hono()

// Simple user table - stored in-memory for now
const users = new Map<string, { id: string; email: string; password: string; firstName: string; lastName: string }>()

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
})

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
})

/**
 * POST /auth/login - Login with email/password
 */
app.post('/login', async (c) => {
    try {
        const body = await c.req.json()
        const input = loginSchema.parse(body)

        // Find user by email
        const user = Array.from(users.values()).find(u => u.email === input.email)

        if (!user || user.password !== input.password) {
            return c.json(
                { error: 'Invalid email or password', detail: 'Invalid email or password' },
                401
            )
        }

        // Generate a simple token (in production, use JWT)
        const token = `tok_${nanoid(32)}`

        return c.json({
            success: true,
            token,
            user: {
                user_id: user.id,
                firebase_user_id: user.id,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
            },
        })
    } catch (error) {
        console.error('Login error:', error)
        if (error instanceof z.ZodError) {
            return c.json(
                { error: 'Invalid input', detail: error.errors[0]?.message },
                400
            )
        }
        return c.json(
            { error: 'Authentication failed', detail: (error as any)?.message || 'Unknown error' },
            500
        )
    }
})

/**
 * POST /auth/signup - Sign up with email/password
 */
app.post('/signup', async (c) => {
    try {
        const body = await c.req.json()
        const input = signupSchema.parse(body)

        // Check if user already exists
        const existingUser = Array.from(users.values()).find(u => u.email === input.email)

        if (existingUser) {
            return c.json(
                { error: 'User already exists', detail: 'User with this email already exists' },
                409
            )
        }

        // Create new user
        const userId = `usr_${nanoid(16)}`
        const newUser = {
            id: userId,
            email: input.email,
            password: input.password,
            firstName: input.firstName || '',
            lastName: input.lastName || '',
        }
        users.set(userId, newUser)

        // Generate token
        const token = `tok_${nanoid(32)}`

        return c.json({
            success: true,
            token,
            user: {
                user_id: userId,
                firebase_user_id: userId,
                email: input.email,
                first_name: newUser.firstName,
                last_name: newUser.lastName,
            },
        })
    } catch (error) {
        console.error('Signup error:', error)
        if (error instanceof z.ZodError) {
            return c.json(
                { error: 'Invalid input', detail: error.errors[0]?.message },
                400
            )
        }
        return c.json(
            { error: 'Sign up failed', detail: (error as any)?.message || 'Unknown error' },
            500
        )
    }
})

/**
 * POST /auth/forgot-password - Request password reset
 */
app.post('/forgot-password', async (c) => {
    try {
        const body = await c.req.json()
        const { email } = z.object({ email: z.string().email() }).parse(body)

        // Check if user exists
        const user = Array.from(users.values()).find(u => u.email === email)

        if (!user) {
            // Don't reveal if user exists or not for security
            return c.json({
                success: true,
                message: 'If an account exists with this email, a password reset link will be sent.',
            })
        }

        // In production: Send password reset email
        console.log(`Password reset requested for: ${email}`)

        return c.json({
            success: true,
            message: 'If an account exists with this email, a password reset link will be sent.',
        })
    } catch (error) {
        console.error('Forgot password error:', error)
        return c.json(
            { error: 'Failed to process request', detail: (error as any)?.message || 'Unknown error' },
            500
        )
    }
})

/**
 * GET /auth/health - Health check
 */
app.get('/health', (c) => {
    return c.json({ status: 'ok', service: 'auth' })
})

export { app as authRoutes }

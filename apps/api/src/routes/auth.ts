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
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    firebase_token: z.string().optional(),
    firebase_user_id: z.string().optional(),
    firebase_uid: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
})

const signupSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    firebase_token: z.string().optional(),
    firebase_user_id: z.string().optional(),
    firebase_uid: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
})

/**
 * POST /auth/login - Login with email/password or Firebase token
 */
app.post('/login', async (c) => {
    try {
        const body = await c.req.json()
        const input = loginSchema.parse(body)

        // Check if this is Firebase authentication
        if (input.firebase_token || input.firebase_user_id) {
            // Firebase/Google Sign-In
            const firebaseUserId = input.firebase_user_id || input.firebase_uid || nanoid(16)
            const email = input.email || `user_${firebaseUserId}@firebase.local`

            // Check if user exists, if not create one
            let user = Array.from(users.values()).find(u => u.email === email)

            if (!user) {
                // Auto-create user for Firebase login
                const userId = `usr_${nanoid(16)}`
                user = {
                    id: userId,
                    email: email,
                    password: nanoid(32), // Random password for Firebase users
                    firstName: input.first_name || email.split('@')[0],
                    lastName: input.last_name || '',
                }
                users.set(userId, user)
                console.log(`✅ Auto-created user for Firebase login: ${email}`)
            }

            // Use the firebase_token as auth token or generate a new one
            const token = input.firebase_token || `tok_${nanoid(32)}`

            return c.json({
                success: true,
                token,
                user: {
                    user_id: user.id,
                    firebase_user_id: firebaseUserId,
                    email: user.email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                },
            })
        }

        // Regular email/password authentication
        if (!input.email || !input.password) {
            return c.json(
                { error: 'Email and password are required', detail: 'Email and password are required' },
                400
            )
        }

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
 * POST /auth/signup - Sign up with email/password or Firebase token
 */
app.post('/signup', async (c) => {
    try {
        const body = await c.req.json()
        const input = signupSchema.parse(body)

        // Check if this is Firebase authentication
        if (input.firebase_token || input.firebase_user_id) {
            // Firebase/Google Sign-In (auto-signup)
            const firebaseUserId = input.firebase_user_id || input.firebase_uid || nanoid(16)
            const email = input.email || `user_${firebaseUserId}@firebase.local`

            // Check if user exists
            let user = Array.from(users.values()).find(u => u.email === email)

            if (user) {
                // User already exists, return existing user (treated as login)
                const token = input.firebase_token || `tok_${nanoid(32)}`
                return c.json({
                    success: true,
                    token,
                    user: {
                        user_id: user.id,
                        firebase_user_id: firebaseUserId,
                        email: user.email,
                        first_name: user.firstName,
                        last_name: user.lastName,
                    },
                })
            }

            // Create new user for Firebase signup
            const userId = `usr_${nanoid(16)}`
            user = {
                id: userId,
                email: email,
                password: nanoid(32), // Random password for Firebase users
                firstName: input.first_name || input.firstName || email.split('@')[0],
                lastName: input.last_name || input.lastName || '',
            }
            users.set(userId, user)
            console.log(`✅ Created user via Firebase signup: ${email}`)

            const token = input.firebase_token || `tok_${nanoid(32)}`

            return c.json({
                success: true,
                token,
                user: {
                    user_id: userId,
                    firebase_user_id: firebaseUserId,
                    email: email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                },
            })
        }

        // Regular email/password signup
        if (!input.email || !input.password) {
            return c.json(
                { error: 'Email and password are required', detail: 'Email and password are required' },
                400
            )
        }

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
            firstName: input.firstName || input.first_name || '',
            lastName: input.lastName || input.last_name || '',
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

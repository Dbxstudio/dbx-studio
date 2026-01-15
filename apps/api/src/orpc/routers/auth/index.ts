import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db } from '~/drizzle'
import { nanoid } from 'nanoid'

// Simple user table - stored in-memory for now (you can add a real users table later)
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

const forgotPasswordSchema = z.object({
    email: z.string().email(),
})

/**
 * Login with email/password
 */
export const login = orpc
    .input(loginSchema)
    .handler(async ({ input }) => {
        // Find user by email
        const user = Array.from(users.values()).find(u => u.email === input.email)

        if (!user || user.password !== input.password) {
            throw new ORPCError('UNAUTHORIZED', {
                message: 'Invalid email or password',
            })
        }

        // Generate a simple token (in production, use JWT)
        const token = `tok_${nanoid(32)}`

        return {
            token,
            user: {
                user_id: user.id,
                firebase_user_id: user.id, // Using same ID for compatibility
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
            },
        }
    })

/**
 * Sign up with email/password
 */
export const signup = orpc
    .input(signupSchema)
    .handler(async ({ input }) => {
        // Check if user already exists
        const existingUser = Array.from(users.values()).find(u => u.email === input.email)

        if (existingUser) {
            throw new ORPCError('CONFLICT', {
                message: 'User with this email already exists',
            })
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

        return {
            token,
            user: {
                user_id: userId,
                firebase_user_id: userId,
                email: input.email,
                first_name: newUser.firstName,
                last_name: newUser.lastName,
            },
        }
    })

/**
 * Forgot password - sends reset email (mock for now)
 */
export const forgotPassword = orpc
    .input(forgotPasswordSchema)
    .handler(async ({ input }) => {
        // In production, this would send an email
        console.log(`Password reset requested for: ${input.email}`)

        return {
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.',
        }
    })

/**
 * Validate token and get user info
 */
export const me = orpc
    .handler(async ({ context }) => {
        // Extract token from Authorization header
        const authHeader = context.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new ORPCError('UNAUTHORIZED', {
                message: 'No authorization token provided',
            })
        }

        const token = authHeader.substring(7)

        // In production, validate the token properly
        // For now, just return a dummy response if token exists
        if (!token.startsWith('tok_')) {
            throw new ORPCError('UNAUTHORIZED', {
                message: 'Invalid token',
            })
        }

        // Return the first user (for demo purposes)
        const user = Array.from(users.values())[0]
        if (!user) {
            throw new ORPCError('UNAUTHORIZED', {
                message: 'User not found',
            })
        }

        return {
            user_id: user.id,
            firebase_user_id: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
        }
    })

// Export all auth routes
export const authRouter = {
    login,
    signup,
    forgotPassword,
    me,
}

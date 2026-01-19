/**
 * Authentication Token Manager
 * Handles token storage, retrieval, validation, and refresh
 * Same flow as sumr-ai-sql-client
 */

const TOKEN_KEY = 'dbx_auth_token'
const USER_INFO_KEY = 'dbx_user_info'
const TOKEN_EXPIRY_KEY = 'dbx_token_expiry'
const REFRESH_TOKEN_KEY = 'dbx_refresh_token'
const TOKEN_TYPE_KEY = 'dbx_token_type' // 'custom' | 'firebase' | 'cognito'

// Import server configuration
import { MAIN_SERVER_ENDPOINT, AUTH_ENDPOINTS } from '../constants/serverConfig'
import { getAuthToken as getCognitoToken } from './cognitoTokenManager'

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDbwkcGLiA1Qzv0b2kexialt2mLyZ3FwT0'

// Token expiry buffer (refresh if token expires in less than 5 minutes)
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export interface UserInfo {
    user_id: string
    firebase_user_id: string
    email: string
    first_name: string
    last_name: string
    profile_pic_url?: string
}

/**
 * Get the current auth token from localStorage
 */
export function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
}

/**
 * Get the current user info from localStorage
 */
export function getUserInfo(): UserInfo | null {
    const userInfoStr = localStorage.getItem(USER_INFO_KEY)
    if (!userInfoStr) return null

    try {
        const parsed = JSON.parse(userInfoStr)
        // Ensure user_id is always a string (backend might return it as number)
        if (parsed && parsed.user_id !== undefined) {
            parsed.user_id = String(parsed.user_id)
        }
        return parsed
    } catch {
        return null
    }
}

/**
 * Get the token type (custom, firebase, or cognito)
 */
export function getTokenType(): 'custom' | 'firebase' | 'cognito' {
    return (localStorage.getItem(TOKEN_TYPE_KEY) as 'custom' | 'firebase' | 'cognito') || 'custom'
}

/**
 * Get the refresh token
 */
export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Store auth token from custom backend (after Firebase auth)
 */
export function setCustomAuthToken(token: string, userInfo: UserInfo, refreshToken: string | null = null): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo))
    localStorage.setItem(TOKEN_TYPE_KEY, 'custom')

    // Store refresh token if provided
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }

    // For custom tokens, set expiry based on Firebase token (typically 1 hour)
    const expiryTime = Date.now() + (60 * 60 * 1000) // 1 hour
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

/**
 * Store auth token from Firebase response
 */
export function setAuthToken(firebaseResponse: {
    idToken: string
    refreshToken: string
    expiresIn: string
    email: string
    localId: string
    displayName?: string
}): void {
    // Store the idToken
    localStorage.setItem(TOKEN_KEY, firebaseResponse.idToken)

    // Store refresh token
    localStorage.setItem(REFRESH_TOKEN_KEY, firebaseResponse.refreshToken)

    // Store token type
    localStorage.setItem(TOKEN_TYPE_KEY, 'firebase')

    // Store user info
    const userInfo: UserInfo = {
        user_id: firebaseResponse.localId,
        firebase_user_id: firebaseResponse.localId,
        email: firebaseResponse.email,
        first_name: firebaseResponse.displayName || '',
        last_name: ''
    }
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo))

    // Calculate and store expiry time
    const expiresIn = parseInt(firebaseResponse.expiresIn, 10)
    const expiryTime = Date.now() + (expiresIn * 1000)
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

/**
 * Clear auth token and user info (on logout)
 */
export function clearAuthToken(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_INFO_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_TYPE_KEY)
}

/**
 * Check if the current token is valid (exists and not expired)
 */
export function isTokenValid(): boolean {
    const token = getAuthToken()
    if (!token) return false

    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (!expiryStr) {
        // If no expiry is set, assume token is valid
        return true
    }

    const expiryTime = parseInt(expiryStr, 10)
    const now = Date.now()

    // Check if token is expired or will expire soon
    return expiryTime > (now + EXPIRY_BUFFER_MS)
}

/**
 * Check if token needs refresh (expires within buffer time)
 */
export function shouldRefreshToken(): boolean {
    const token = getAuthToken()
    if (!token) return false

    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (!expiryStr) return false

    const expiryTime = parseInt(expiryStr, 10)
    const now = Date.now()

    // Refresh if expires within buffer time
    return expiryTime <= (now + EXPIRY_BUFFER_MS) && expiryTime > now
}

/**
 * Refresh the auth token
 */
export async function refreshAuthToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    const tokenType = getTokenType()

    if (tokenType === 'firebase') {
        return await refreshFirebaseToken()
    } else if (tokenType === 'cognito') {
        return await refreshCognitoToken()
    } else {
        return await refreshCustomToken()
    }
}

/**
 * Refresh Cognito token (Amplify handles this automatically)
 */
async function refreshCognitoToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
        // Amplify automatically refreshes tokens when calling getCognitoToken
        const token = await getCognitoToken()

        if (token) {
            // Update the stored token
            localStorage.setItem(TOKEN_KEY, token)

            // Update expiry (Cognito tokens typically last 1 hour)
            const expiryTime = Date.now() + (60 * 60 * 1000)
            localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())

            return { success: true, token }
        }

        return { success: false, error: 'Failed to refresh Cognito token' }
    } catch (error: any) {
        return { success: false, error: error.message || 'Cognito token refresh failed' }
    }
}

/**
 * Refresh custom backend token
 */
async function refreshCustomToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
        return { success: false, error: 'No refresh token available' }
    }

    try {
        // Call backend to refresh the token
        const response = await fetch(AUTH_ENDPOINTS.REFRESH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.detail || `Token refresh failed: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.status === 'success' && data.token) {
            // Update the access token
            localStorage.setItem(TOKEN_KEY, data.token)

            // Update refresh token if provided
            if (data.refresh_token) {
                localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
            }

            // Update user info if provided
            if (data.user) {
                localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user))
            }

            // Update expiry (1 hour)
            const expiryTime = Date.now() + (60 * 60 * 1000)
            localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())

            return { success: true, token: data.token }
        }

        throw new Error('Invalid refresh response')

    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Refresh Firebase token
 */
async function refreshFirebaseToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
        return { success: false, error: 'No refresh token available' }
    }

    try {
        // Use Firebase token refresh endpoint
        const response = await fetch(
            `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            }
        )

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error?.message || `Token refresh failed: ${response.statusText}`)
        }

        const data = await response.json()

        // Firebase refresh response format
        if (data.id_token) {
            const firebaseResponse = {
                idToken: data.id_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                email: data.email || '',
                localId: data.user_id,
                displayName: ''
            }

            setAuthToken(firebaseResponse)
            return { success: true, token: data.id_token }
        }

        throw new Error('Invalid response from Firebase refresh endpoint')

    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Get a valid token, refreshing if necessary
 */
export async function getValidToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    // Check if token exists
    const token = getAuthToken()
    if (!token) {
        return { success: false, error: 'No authentication token found' }
    }

    // Check if token is valid
    if (isTokenValid()) {
        return { success: true, token }
    }

    // Token is expired or about to expire, try to refresh
    const refreshResult = await refreshAuthToken()

    if (refreshResult.success) {
        return { success: true, token: refreshResult.token }
    }

    // Refresh failed
    return { success: false, error: 'Token expired and refresh failed' }
}

/**
 * Make an authenticated API request
 * Automatically handles 401 responses by refreshing token and retrying once
 * Matches the same pattern as sumr-ai-sql-client
 * @param url - The API endpoint URL
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Get a valid token
    const tokenResult = await getValidToken()

    if (!tokenResult.success || !tokenResult.token) {
        throw new Error(tokenResult.error || 'Authentication required')
    }

    // Add Authorization header
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
        'Authorization': `Bearer ${tokenResult.token}`
    }

    // Make the request
    let response = await fetch(url, {
        ...options,
        headers
    })

    // If we get a 401, try to refresh token and retry once
    if (response.status === 401) {
        const refreshResult = await refreshAuthToken()

        if (refreshResult.success && refreshResult.token) {
            // Retry the request with the new token
            const newHeaders: Record<string, string> = {
                ...(options.headers as Record<string, string> || {}),
                'Authorization': `Bearer ${refreshResult.token}`
            }

            response = await fetch(url, {
                ...options,
                headers: newHeaders
            })
        } else {
            // Clear tokens and force re-login
            clearAuthToken()
            throw new Error('Session expired. Please login again.')
        }
    }

    return response
}

/**
 * Check authentication status
 */
export function getAuthStatus(): { isAuthenticated: boolean; userInfo: UserInfo | null; token: string | null } {
    const token = getAuthToken()
    const userInfo = getUserInfo()
    const isAuthenticated = !!token && isTokenValid()

    return {
        isAuthenticated,
        userInfo,
        token
    }
}

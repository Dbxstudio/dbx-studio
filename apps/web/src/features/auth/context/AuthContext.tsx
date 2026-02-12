import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
    getAuthToken,
    getUserInfo,
    setCustomAuthToken,
    clearAuthToken,
    isTokenValid,
    getValidToken,
    type UserInfo
} from '../../../shared/utils/authTokenManager'

interface AuthContextType {
    user: UserInfo | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (token: string, user: UserInfo, refreshToken?: string) => void
    logout: () => void
    getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserInfo | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Initialize from localStorage using authTokenManager
    useEffect(() => {
        let storedToken = getAuthToken()
        let storedUser = getUserInfo()
        const isWebMode = import.meta.env.VITE_APP_MODE === 'web'

        console.log('🔄 [AuthContext] Initializing...', {
            isWebMode,
            hasToken: !!storedToken,
            hasUser: !!storedUser,
            user_id: storedUser?.user_id,
            isValid: isTokenValid()
        })

        // If in Web Mode and we found a Guest User session, clear it to force login
        if (isWebMode && storedUser?.user_id === 'guest_user') {
            console.log('🔒 [AuthContext] Web Mode detected: Clearing previous Guest session')
            clearAuthToken()
            storedToken = null
            storedUser = null
        }

        const isValid = isTokenValid()

        if (storedToken && storedUser && isValid) {
            console.log('✅ [AuthContext] User restored from storage:', storedUser.email)
            setToken(storedToken)
            setUser(storedUser)
            console.log('✅ [AuthContext] State updated with user')
        } else if (storedToken && storedUser) {
            // Token exists but might be expired, try to refresh
            console.log('⚠️ [AuthContext] Token may be expired, will try to refresh on next request')
            setToken(storedToken)
            setUser(storedUser)
        } else {
            console.log('❌ [AuthContext] No valid session found. Mode:', isWebMode ? 'WEB' : 'LOCAL')
            // Check environment Mode
            // Use standard import.meta.env access
            // const isWebMode ... (already defined above)

            if (isWebMode) {
                // Web mode: Do not auto-login as guest. User must login manually.
                console.log('🔒 [AuthContext] Web Mode detected: Waiting for user login')
                // Do nothing here, token/user remain null
            } else {
                // Auto-login with default guest user (no login required)
                const defaultToken = 'guest_token_' + Math.random().toString(36).substr(2, 9)
                const defaultUser: UserInfo = {
                    user_id: 'guest_user',
                    firebase_user_id: 'guest_user',
                    email: 'guest@dbxstudio.local',
                    first_name: 'Guest',
                    last_name: 'User',
                    profile_pic_url: undefined
                }
                setCustomAuthToken(defaultToken, defaultUser, null)
                setToken(defaultToken)
                setUser(defaultUser)
                console.log('✅ [AuthContext] Initialized as guest user (no login required)')
            }
        }

        setIsLoading(false)
    }, [])

    const login = useCallback((newToken: string, newUser: UserInfo, refreshToken?: string) => {
        // Store using authTokenManager
        setCustomAuthToken(newToken, newUser, refreshToken || null)

        // Update context state
        setToken(newToken)
        setUser(newUser)

        console.log('✅ [AuthContext] User logged in:', newUser.email)
    }, [])

    const logout = useCallback(() => {
        // Clear using authTokenManager
        clearAuthToken()

        // Clear context state
        setToken(null)
        setUser(null)

        console.log('🔓 [AuthContext] User logged out')
    }, [])

    const getToken = useCallback(async (): Promise<string | null> => {
        // Get a valid token, refreshing if necessary
        const result = await getValidToken()

        if (result.success && result.token) {
            setToken(result.token)
            return result.token
        }

        // Token is invalid and couldn't be refreshed
        if (!result.success) {
            console.error('❌ [AuthContext] Failed to get valid token:', result.error)
            logout()
        }

        return null
    }, [logout])

    const value: AuthContextType = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        getToken,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

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
        const storedToken = getAuthToken()
        const storedUser = getUserInfo()

        if (storedToken && storedUser && isTokenValid()) {
            setToken(storedToken)
            setUser(storedUser)
        } else if (storedToken && storedUser) {
            // Token exists but might be expired, try to refresh on next request
            setToken(storedToken)
            setUser(storedUser)
        }

        setIsLoading(false)
    }, [])

    const login = useCallback((newToken: string, newUser: UserInfo, refreshToken?: string) => {
        // Store using authTokenManager
        setCustomAuthToken(newToken, newUser, refreshToken || null)

        // Update context state
        setToken(newToken)
        setUser(newUser)
    }, [])

    const logout = useCallback(() => {
        // Clear using authTokenManager
        clearAuthToken()

        // Clear context state
        setToken(null)
        setUser(null)
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

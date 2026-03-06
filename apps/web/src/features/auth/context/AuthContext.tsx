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

// Import Amplify signOut to clear the Cognito session on local logout
import { signOut as amplifySignOut } from 'aws-amplify/auth'

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
        // Check URL for tokens (if redirected from live site)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const urlUser = urlParams.get('user');
        const urlRefreshToken = urlParams.get('refreshToken');

        if (urlToken && urlUser) {
            try {
                const parsedUser = JSON.parse(decodeURIComponent(urlUser));
                setCustomAuthToken(urlToken, parsedUser, urlRefreshToken || null);
                setToken(urlToken);
                setUser(parsedUser);
                console.log('✅ [AuthContext] User logged in from redirect URL');

                // Clear any explicit logout flag since we just logged in via redirect
                localStorage.removeItem('dbx_explicit_logout');

                // Cleanup URL
                window.history.replaceState({}, document.title, window.location.pathname);
                setIsLoading(false);
                return;
            } catch (e) {
                console.error("❌ [AuthContext] Failed to parse user from redirect URL", e);
            }
        }

        const storedToken = getAuthToken()
        const storedUser = getUserInfo()

        // If the user explicitly logged out locally, don't auto-restore session
        // This prevents the auto-login loop where local logout triggers immediate re-login
        const isExplicitlyLoggedOut = localStorage.getItem('dbx_explicit_logout') === 'true';

        if (storedToken && storedUser && !isExplicitlyLoggedOut) {
            if (isTokenValid()) {
                setToken(storedToken)
                setUser(storedUser)
                console.log('✅ [AuthContext] User restored from storage')
            } else {
                // Token exists but might be expired
                console.log('⚠️ [AuthContext] Token may be expired, will try to refresh on next request')
                setToken(storedToken)
                setUser(storedUser)
            }
        } else if (isExplicitlyLoggedOut) {
            console.log('🔒 [AuthContext] Explicit logout detected — skipping auto-restore')
        } else {
            console.log('ℹ️ [AuthContext] No valid token found, user needs to login')
        }

        setIsLoading(false)
    }, [])

    const login = useCallback((newToken: string, newUser: UserInfo, refreshToken?: string) => {
        // Store using authTokenManager
        setCustomAuthToken(newToken, newUser, refreshToken || null)

        // Update context state
        setToken(newToken)
        setUser(newUser)

        localStorage.removeItem('dbx_explicit_logout')
        console.log('✅ [AuthContext] User logged in:', newUser.email)
    }, [])

    const logout = useCallback(() => {
        // CRITICAL: Set the explicit logout flag FIRST, before any state updates
        // This ensures the Login component's useEffect sees the flag BEFORE it can redirect
        localStorage.setItem('dbx_explicit_logout', 'true')

        // Clear using authTokenManager (removes all tokens from localStorage)
        clearAuthToken()

        // Clear context state
        setToken(null)
        setUser(null)

        // Also sign out from Amplify/Cognito so it cannot silently issue new tokens
        amplifySignOut({ global: false }).catch(() => {
            // Ignore errors - we still want local logout to succeed even if Amplify fails
        })

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

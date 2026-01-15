import { useState, useCallback, useEffect } from 'react'
import { LuMail, LuEye, LuEyeOff, LuArrowLeft } from 'react-icons/lu'
import { useAuth } from '../../context/AuthContext'
import { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordResetEmail } from '../../../../shared/utils/firebase'
import { setCustomAuthToken } from '../../../../shared/utils/authTokenManager'
import './Login.css'

// Main Server API endpoint
const MAIN_SERVER_URL = import.meta.env.VITE_MAIN_SERVER_URL || 'https://fp9waphqm5.us-east-1.awsapprunner.com/api/v1'

type ViewType = 'options' | 'emailForm' | 'forgotPassword'
type AuthMode = 'login' | 'signup'

interface LoginProps {
    onSuccess?: () => void
}

export function Login({ onSuccess }: LoginProps) {
    const { login } = useAuth()

    // State
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [loginSuccess, setLoginSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [termsAccepted, setTermsAccepted] = useState(true) // Default to true for easier testing

    // Form fields
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // Mode and view
    const [authMode, setAuthMode] = useState<AuthMode>('login')
    const [currentView, setCurrentView] = useState<ViewType>('options')
    const [authLoadingMessage, setAuthLoadingMessage] = useState('Authenticating...')

    // Clear errors after timeout
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(null), 10000)
            return () => clearTimeout(timer)
        }
    }, [errorMessage])

    // Toggle functions
    const toggleTerms = useCallback(() => setTermsAccepted(prev => !prev), [])
    const toggleAuthMode = useCallback(() => {
        setAuthMode(prev => prev === 'login' ? 'signup' : 'login')
        setErrorMessage(null)
        setPassword('')
        setConfirmPassword('')
    }, [])
    const togglePasswordVisibility = useCallback(() => setShowPassword(prev => !prev), [])

    const showEmailForm = useCallback(() => {
        setCurrentView('emailForm')
        setErrorMessage(null)
    }, [])

    const showForgotPasswordView = useCallback(() => {
        setCurrentView('forgotPassword')
        setErrorMessage(null)
        setSuccessMessage(null)
        setEmail('')
    }, [])

    const goBackToOptions = useCallback(() => {
        setCurrentView('options')
        setErrorMessage(null)
        setSuccessMessage(null)
        setEmail('')
        setPassword('')
        setConfirmPassword('')
    }, [])

    /**
     * Handle token received from Firebase authentication
     * Validates with backend server and stores user data
     */
    const handleTokenReceived = useCallback(async (
        token: string,
        refreshToken: string | null,
        firebaseUser: { uid: string; email: string | null; displayName: string | null } | null,
        isSignup: boolean
    ) => {
        console.log('🔐 Token received, validating with backend...')
        setAuthLoadingMessage('Verifying credentials...')

        try {
            // Call backend to validate token and get user data
            const endpoint = isSignup ? '/auth/signup' : '/auth/login'

            // Extract first and last name from displayName
            const displayName = firebaseUser?.displayName || ''
            const nameParts = displayName.split(' ')
            const firstName = nameParts[0] || firebaseUser?.email?.split('@')[0] || 'User'
            const lastName = nameParts.slice(1).join(' ') || ''

            const response = await fetch(`${MAIN_SERVER_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    firebase_token: token,
                    firebase_user_id: firebaseUser?.uid,
                    email: firebaseUser?.email,
                    firebase_uid: firebaseUser?.uid,
                    first_name: firstName,
                    last_name: lastName
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || errorData.message || 'Authentication failed')
            }

            const data = await response.json()

            // Store auth token and user info
            const userInfo = {
                user_id: String(data.user?.user_id || firebaseUser?.uid || ''),
                firebase_user_id: firebaseUser?.uid || '',
                email: data.user?.email || firebaseUser?.email || '',
                first_name: data.user?.first_name || firebaseUser?.displayName?.split(' ')[0] || '',
                last_name: data.user?.last_name || firebaseUser?.displayName?.split(' ').slice(1).join(' ') || '',
                profile_pic_url: data.user?.profile_pic_url
            }

            // Store in authTokenManager
            setCustomAuthToken(data.token || token, userInfo, refreshToken)

            // Also store in AuthContext
            login(data.token || token, userInfo, refreshToken || undefined)

            setIsAuthenticating(false)
            setLoginSuccess(true)

            console.log('✅ Login successful!')

            // Trigger success callback
            setTimeout(() => {
                onSuccess?.()
            }, 1500)

        } catch (error) {
            console.error('Backend validation error:', error)
            setIsAuthenticating(false)
            setErrorMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
        }
    }, [login, onSuccess])

    // Handle login/signup with email
    const handleEmailPasswordAuth = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()

        if (!termsAccepted) {
            setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.')
            return
        }

        if (!email || !email.includes('@')) {
            setErrorMessage('Please enter a valid email address.')
            return
        }

        if (!password || password.length < 6) {
            setErrorMessage('Password must be at least 6 characters.')
            return
        }

        if (authMode === 'signup' && password !== confirmPassword) {
            setErrorMessage('Passwords do not match.')
            return
        }

        console.log(`🔐 ${authMode === 'login' ? 'Login' : 'Signup'} with email:`, email)
        setIsAuthenticating(true)
        setErrorMessage(null)
        setAuthLoadingMessage(authMode === 'login' ? 'Signing in...' : 'Creating account...')

        try {
            // Use Firebase for authentication
            let result
            if (authMode === 'login') {
                result = await signInWithEmail(email, password)
            } else {
                result = await signUpWithEmail(email, password)
            }

            if (!result.success) {
                throw new Error(result.error || 'Authentication failed')
            }

            // Handle token received from Firebase
            await handleTokenReceived(
                result.token!,
                result.refreshToken || null,
                result.user!,
                authMode === 'signup'
            )

        } catch (error) {
            console.error('Auth error:', error)
            setIsAuthenticating(false)
            setErrorMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
        }
    }, [email, password, confirmPassword, authMode, termsAccepted, handleTokenReceived])

    // Handle Google login
    const handleGoogleLogin = useCallback(async () => {
        if (!termsAccepted) {
            setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.')
            return
        }

        console.log('🔐 Starting Google sign-in...')
        setIsAuthenticating(true)
        setErrorMessage(null)
        setAuthLoadingMessage('Signing in with Google...')

        try {
            const result = await signInWithGoogle()

            if (!result.success) {
                throw new Error(result.error || 'Google sign-in failed')
            }

            // Handle token received from Firebase
            await handleTokenReceived(
                result.token!,
                result.refreshToken || null,
                result.user!,
                false // Google sign-in is treated as login
            )

        } catch (error) {
            console.error('Google auth error:', error)
            setIsAuthenticating(false)
            setErrorMessage(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.')
        }
    }, [termsAccepted, handleTokenReceived])

    // Handle forgot password
    const handleForgotPassword = useCallback(async () => {
        if (!email || !email.includes('@')) {
            setErrorMessage('Please enter your email address first.')
            return
        }

        try {
            const result = await sendPasswordResetEmail(email)

            if (result.success) {
                setSuccessMessage(`Password reset email sent to ${email}. Please check your inbox.`)
            } else {
                setErrorMessage(result.error || 'Failed to send password reset email.')
            }
        } catch (error) {
            setErrorMessage('Failed to send password reset email. Please try again.')
        }
    }, [email])

    // Render options view (initial screen)
    const renderOptionsView = () => (
        <>
            <p className="login-description">
                Sign in to access your database connections<br />
                and manage your workspace.
            </p>

            <div className="auth-buttons">
                {/* Google Sign-in */}
                <button
                    className="google-button"
                    onClick={handleGoogleLogin}
                    disabled={isAuthenticating}
                >
                    <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                </button>

                {/* Email Sign-in Button */}
                <button
                    className="email-button"
                    onClick={showEmailForm}
                    disabled={isAuthenticating}
                >
                    <LuMail className="email-icon" />
                    Sign in with Email
                </button>
            </div>

            {/* Terms Checkbox */}
            <div className="terms-container">
                <input
                    type="checkbox"
                    id="terms"
                    className="terms-checkbox"
                    checked={termsAccepted}
                    onChange={toggleTerms}
                />
                <label htmlFor="terms" className="terms-text">
                    I agree to the <a href="https://www.dbxstudio.com/terms" target="_blank" rel="noopener noreferrer" className="terms-link">Terms of Service</a> and <a href="https://www.dbxstudio.com/privacy" target="_blank" rel="noopener noreferrer" className="terms-link">Privacy Policy</a>
                </label>
            </div>

            {errorMessage && (
                <div className="login-error-message">
                    {errorMessage}
                </div>
            )}
        </>
    )

    // Render email form
    const renderEmailForm = () => {
        const isLogin = authMode === 'login'

        return (
            <>
                <p className="login-description">
                    {isLogin
                        ? 'Sign in to your account to continue.'
                        : 'Create a new account to get started.'}
                </p>

                {/* Back Button */}
                <button
                    className="login-back-button"
                    onClick={goBackToOptions}
                >
                    <LuArrowLeft />
                    <span>Back</span>
                </button>

                {/* Email/Password Form */}
                <form className="auth-form" onSubmit={handleEmailPasswordAuth}>
                    <div className="input-group">
                        <input
                            type="email"
                            className="auth-input"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isAuthenticating}
                            autoComplete="email"
                        />
                        <LuMail className="input-icon" />
                    </div>

                    <div className="input-group">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="auth-input password-input"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isAuthenticating}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={togglePasswordVisibility}
                        >
                            {showPassword ? <LuEyeOff /> : <LuEye />}
                        </button>
                    </div>

                    {!isLogin && (
                        <div className="input-group">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="auth-input password-input"
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isAuthenticating}
                                autoComplete="new-password"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="submit-button"
                        disabled={isAuthenticating}
                    >
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                {/* Forgot Password Link */}
                {isLogin && (
                    <div className="forgot-password-link-container">
                        <button
                            className="forgot-password-link"
                            onClick={showForgotPasswordView}
                        >
                            Forgot Password?
                        </button>
                    </div>
                )}

                {/* Mode Toggle */}
                <div className="mode-toggle">
                    <span className="mode-text">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                    </span>
                    <button
                        type="button"
                        className="mode-link"
                        onClick={toggleAuthMode}
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </div>

                {/* Terms Checkbox */}
                <div className="terms-container">
                    <input
                        type="checkbox"
                        id="terms-form"
                        className="terms-checkbox"
                        checked={termsAccepted}
                        onChange={toggleTerms}
                    />
                    <label htmlFor="terms-form" className="terms-text">
                        I agree to the <a href="https://www.dbxstudio.com/terms" target="_blank" rel="noopener noreferrer" className="terms-link">Terms of Service</a> and <a href="https://www.dbxstudio.com/privacy" target="_blank" rel="noopener noreferrer" className="terms-link">Privacy Policy</a>
                    </label>
                </div>

                {errorMessage && (
                    <div className="login-error-message">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="login-success-message">
                        {successMessage}
                    </div>
                )}
            </>
        )
    }

    // Render forgot password view
    const renderForgotPasswordView = () => (
        <>
            <p className="login-description">
                Enter your email address and we'll send you a link to reset your password.
            </p>

            {/* Back Button */}
            <button
                className="login-back-button"
                onClick={goBackToOptions}
            >
                <LuArrowLeft />
                <span>Back</span>
            </button>

            {/* Email Input Form */}
            <form className="auth-form" onSubmit={(e) => {
                e.preventDefault()
                handleForgotPassword()
            }}>
                <div className="input-group">
                    <input
                        type="email"
                        className="auth-input"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        autoFocus
                    />
                    <LuMail className="input-icon" />
                </div>

                <button
                    type="submit"
                    className="submit-button"
                >
                    Send Reset Link
                </button>
            </form>

            {errorMessage && (
                <div className="login-error-message">
                    {errorMessage}
                </div>
            )}

            {successMessage && (
                <div className="login-success-message">
                    {successMessage}
                </div>
            )}
        </>
    )

    // Render authenticating view
    const renderAuthenticatingView = () => (
        <>
            <img
                src="/assets/dbx-logo-white.png"
                alt="DBX Studio Logo"
                className="login-logo"
            />
            <h1 className="login-title">Authenticating</h1>

            {/* Back Button */}
            <button
                className="login-back-button"
                onClick={() => {
                    setIsAuthenticating(false)
                    setErrorMessage(null)
                    setCurrentView('options')
                }}
            >
                <LuArrowLeft />
                <span>Cancel</span>
            </button>

            <div className="auth-loading-container">
                <div className="spinner"></div>
                <div className="loading-message">
                    <p className="loading-title">{authLoadingMessage}</p>
                    <p className="loading-subtitle">Please wait while we verify your credentials...</p>
                </div>
            </div>
        </>
    )

    // Render success view
    const renderSuccessView = () => (
        <>
            <div className="success-icon">✓</div>
            <h1 className="login-title">Login Successful!</h1>
            <p className="login-description">
                Welcome back! Redirecting you to your workspace...
            </p>
        </>
    )

    return (
        <div className="login-container dark">
            <div className="login-card">
                <div className="login-content">
                    {loginSuccess ? (
                        renderSuccessView()
                    ) : isAuthenticating ? (
                        renderAuthenticatingView()
                    ) : (
                        <>
                            <img
                                src="/assets/dbx-logo-white.png"
                                alt="DBX Studio Logo"
                                className="login-logo"
                            />
                            <h1 className="login-title">
                                {currentView === 'forgotPassword' ? 'Reset Password' : 'Welcome to DBX'}
                            </h1>

                            {currentView === 'options' && renderOptionsView()}
                            {currentView === 'emailForm' && renderEmailForm()}
                            {currentView === 'forgotPassword' && renderForgotPasswordView()}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

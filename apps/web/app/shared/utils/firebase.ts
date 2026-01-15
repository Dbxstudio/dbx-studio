/**
 * Firebase Configuration and Initialization
 * Uses the same Firebase project as sumr-ai-sql-client
 */

import { initializeApp } from 'firebase/app'
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    type User
} from 'firebase/auth'

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDbwkcGLiA1Qzv0b2kexialt2mLyZ3FwT0",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dbx-studio-2424c.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dbx-studio-2424c",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dbx-studio-2424c.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "465011398083",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:465011398083:web:0827b0b98375f8315"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')
// Force account selection - allows users to choose which Google account to use
googleProvider.setCustomParameters({
    prompt: 'select_account'
})

export interface FirebaseAuthResult {
    success: boolean
    user?: {
        uid: string
        email: string | null
        displayName: string | null
        photoURL: string | null
    }
    token?: string
    refreshToken?: string
    error?: string
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<FirebaseAuthResult> {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        const user = userCredential.user
        const token = await user.getIdToken()

        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            token,
            refreshToken: user.refreshToken
        }
    } catch (error: any) {
        console.error('Firebase email sign-in error:', error)
        return {
            success: false,
            error: getFirebaseErrorMessage(error.code)
        }
    }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string): Promise<FirebaseAuthResult> {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user
        const token = await user.getIdToken()

        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            token,
            refreshToken: user.refreshToken
        }
    } catch (error: any) {
        console.error('Firebase email sign-up error:', error)
        return {
            success: false,
            error: getFirebaseErrorMessage(error.code)
        }
    }
}

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle(): Promise<FirebaseAuthResult> {
    try {
        console.log('🔐 Starting Google sign-in with popup...')
        const result = await signInWithPopup(auth, googleProvider)
        const user = result.user
        const token = await user.getIdToken()

        console.log('✅ Google sign-in successful')
        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            token,
            refreshToken: user.refreshToken
        }
    } catch (error: any) {
        console.error('Firebase Google sign-in error:', error)
        return {
            success: false,
            error: getFirebaseErrorMessage(error.code)
        }
    }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
    try {
        await firebaseSignOut(auth)
        return { success: true }
    } catch (error: any) {
        console.error('Firebase sign-out error:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * Get current Firebase user
 */
export function getCurrentUser(): User | null {
    return auth.currentUser
}

/**
 * Get fresh ID token for current user
 */
export async function getIdToken(): Promise<string | null> {
    const user = auth.currentUser
    if (!user) return null

    try {
        return await user.getIdToken(true) // Force refresh
    } catch (error) {
        console.error('Error getting ID token:', error)
        return null
    }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        await firebaseSendPasswordResetEmail(auth, email)
        return { success: true }
    } catch (error: any) {
        console.error('Firebase password reset error:', error)
        return {
            success: false,
            error: getFirebaseErrorMessage(error.code)
        }
    }
}

/**
 * Convert Firebase error codes to user-friendly messages
 */
function getFirebaseErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
        'auth/invalid-email': 'Invalid email address format.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled.',
        'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled.',
        'auth/popup-blocked': 'Sign-in popup was blocked by the browser.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid email or password.'
    }

    return errorMessages[errorCode] || 'An error occurred during authentication.'
}

export { auth, googleProvider }

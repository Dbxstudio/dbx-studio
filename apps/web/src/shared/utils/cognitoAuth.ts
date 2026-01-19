import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  resetPassword,
  confirmResetPassword,
  resendSignUpCode,
  fetchAuthSession,
  getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth';

export interface SignUpAttributes {
  firstName?: string;
  lastName?: string;
  genderId?: number | null;
  profilePicUrl?: string | null;
}

export interface SignUpResult {
  success: boolean;
  user?: any;
  userId?: string;
  username?: string;
  nextStep?: string;
  error?: string;
}

export interface SignInResult {
  success: boolean;
  user?: any;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}

export interface ConfirmSignUpResult {
  success: boolean;
  isSignUpComplete?: boolean;
  error?: string;
}

/**
 * Sign up a new user with email and password
 * Generates a unique username since Cognito requires username != email when email is an alias
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  attributes: SignUpAttributes = {}
): Promise<SignUpResult> {
  try {
    // Generate unique username (cannot be email format when email is alias)
    const username = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build user attributes (only send standard Cognito attributes)
    const userAttributes: Record<string, string> = { email };
    if (attributes.firstName) userAttributes.given_name = attributes.firstName;
    if (attributes.lastName) userAttributes.family_name = attributes.lastName;

    const { isSignUpComplete, userId, nextStep } = await signUp({
      username,
      password,
      options: {
        userAttributes,
      },
    });

    return {
      success: true,
      user: {
        email,
        firstName: attributes.firstName,
        lastName: attributes.lastName,
        genderId: attributes.genderId,
        profilePicUrl: attributes.profilePicUrl,
      },
      userId,
      username, // Important: store this for confirmation
      nextStep: nextStep.signUpStep,
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error.message || 'Sign up failed',
    };
  }
}

/**
 * Confirm sign up with verification code
 * IMPORTANT: Use the username from signUpWithEmail, not the email
 */
export async function confirmSignUpWithCode(
  usernameOrEmail: string,
  code: string
): Promise<ConfirmSignUpResult> {
  try {
    const { isSignUpComplete } = await confirmSignUp({
      username: usernameOrEmail,
      confirmationCode: code,
    });

    return {
      success: true,
      isSignUpComplete,
    };
  } catch (error: any) {
    console.error('Confirm sign up error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Sign in with email and password
 * Returns Cognito tokens
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username: email, // Can use email for sign in (email is an alias)
      password,
    });

    if (isSignedIn) {
      // Get tokens from session
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const accessToken = session.tokens?.accessToken?.toString();
      const refreshToken = session.tokens?.idToken?.payload?.['cognito:username']; // Not directly accessible
      const expiresAt = session.tokens?.idToken?.payload?.exp;

      // Get user attributes
      const userAttributes = await fetchUserAttributes();

      return {
        success: true,
        user: {
          userId: session.tokens?.idToken?.payload?.sub,
          email: userAttributes.email,
          firstName: userAttributes.given_name,
          lastName: userAttributes.family_name,
        },
        token: idToken,
        accessToken,
        refreshToken: '', // Amplify manages refresh tokens internally
        expiresAt,
      };
    }

    return {
      success: false,
      error: 'Sign in incomplete',
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'Sign in failed',
    };
  }
}

/**
 * Resend verification code
 */
export async function resendVerificationCode(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    await resendSignUpCode({ username: email });
    return { success: true };
  } catch (error: any) {
    console.error('Resend code error:', error);
    return {
      success: false,
      error: error.message || 'Failed to resend code',
    };
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    await signOut();
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error.message || 'Sign out failed',
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    await resetPassword({ username: email });
    return { success: true };
  } catch (error: any) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: error.message || 'Password reset failed',
    };
  }
}

/**
 * Confirm password reset with code
 */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Confirm password reset error:', error);
    return {
      success: false,
      error: error.message || 'Password reset confirmation failed',
    };
  }
}

/**
 * Get current auth session (automatically refreshes if needed)
 */
export async function getAuthSession() {
  try {
    return await fetchAuthSession();
  } catch (error) {
    console.error('Get auth session error:', error);
    return null;
  }
}

/**
 * Get current user info
 */
export async function getCurrentUserInfo() {
  try {
    const user = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    return { user, attributes };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

import { fetchAuthSession } from 'aws-amplify/auth';
import { AUTH_ENDPOINTS } from '../constants/serverConfig';

export interface UserData {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  genderId?: number | null;
  profilePicUrl?: string | null;
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  user?: any;
  error?: string;
}

/**
 * Get ID token from Amplify (automatically refreshes if expired)
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Get access token for AWS services
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || null;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Get cached user info from localStorage
 */
export function getUserInfo(): any {
  try {
    const userInfo = localStorage.getItem('dbx_user_info');
    return userInfo ? JSON.parse(userInfo) : null;
  } catch (error) {
    console.error('Failed to get user info:', error);
    return null;
  }
}

/**
 * Clear all auth data from localStorage
 */
export function clearAuthToken(): void {
  localStorage.removeItem('dbx_auth_token');
  localStorage.removeItem('dbx_refresh_token');
  localStorage.removeItem('dbx_token_expiry');
  localStorage.removeItem('dbx_token_type');
  localStorage.removeItem('dbx_user_info');
}

/**
 * Check if user is authenticated
 */
export async function isTokenValid(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null;
}

/**
 * Sync user data with backend server after Cognito authentication
 * This sends the Cognito token to your backend for verification and user creation/login
 */
export async function syncUserWithBackend(
  userData: UserData,
  cognitoToken: string,
  isSignup: boolean = false
): Promise<SyncResult> {
  try {
    const endpoint = isSignup ? AUTH_ENDPOINTS.SIGNUP : AUTH_ENDPOINTS.LOGIN;

    // Prepare request body
    const body: any = {
      cognito_user_id: userData.userId,
      email: userData.email,
    };

    // Add additional fields for signup
    if (isSignup) {
      body.first_name = userData.firstName || '';
      body.last_name = userData.lastName || '';
      body.gender_id = userData.genderId || null;
      body.profile_pic_url = userData.profilePicUrl || null;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cognitoToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Backend sync failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      user: data.user || data,
    };
  } catch (error: any) {
    console.error('Backend sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync with backend',
    };
  }
}

/**
 * Fetch with automatic token injection
 * Automatically refreshes token if needed
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('No authentication token available');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

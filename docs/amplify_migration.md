# AWS Cognito Migration Guide - Complete Implementation

## Table of Contents
1. [Overview](#overview)
2. [What Was Changed](#what-was-changed)
3. [Architecture](#architecture)
4. [Implementation Details](#implementation-details)
5. [Edge Cases & Solutions](#edge-cases--solutions)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Backend Requirements](#backend-requirements)

---

## Overview

### Migration Summary
Successfully migrated from **Firebase Authentication** to **AWS Cognito** using **AWS Amplify v6**.

### Key Changes
- ✅ Replaced Firebase auth with Cognito
- ✅ Changed server URL from AWS AppRunner to `localhost:8000`
- ✅ Implemented email verification with 6-digit code
- ✅ Created token management with automatic refresh via Amplify
- ✅ Backend synchronization after Cognito authentication
- ✅ Proper token persistence in localStorage

### Cognito Configuration
```
User Pool ID: us-east-1_jttIzc3Av
Client ID: 58n2mqt76oqjpau29jbo07bnbl
Region: us-east-1
```

---

## What Was Changed

### Files Created

#### 1. `app/shared/constants/serverConfig.js`
**Purpose:** Centralized server URL configuration

```javascript
export const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:8000';
export const MAIN_SERVER_ENDPOINT = `${MAIN_SERVER_URL}/api/v1`;

export const AUTH_ENDPOINTS = {
  LOGIN: `${MAIN_SERVER_ENDPOINT}/auth/login`,
  SIGNUP: `${MAIN_SERVER_ENDPOINT}/auth/signup`,
  REFRESH: `${MAIN_SERVER_ENDPOINT}/auth/refresh`,
  VERIFY_EMAIL: `${MAIN_SERVER_ENDPOINT}/auth/verify-email`,
};
```

**Why:** Single source of truth for server URLs, easy to change environments

---

#### 2. `app/shared/config/amplifyConfig.js`
**Purpose:** AWS Amplify configuration with Cognito settings

```javascript
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_jttIzc3Av',
      userPoolClientId: '58n2mqt76oqjpau29jbo07bnbl',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true, // Email alias enabled
      },
      userAttributes: {
        given_name: { required: false },
        family_name: { required: false },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    },
  },
};
```

**Key Configuration:**
- Email as sign-in alias (username can be different from email)
- Code-based email verification
- Password requirements: 8+ chars, uppercase, lowercase, numbers

---

#### 3. `app/shared/utils/cognitoAuth.js`
**Purpose:** Complete Cognito authentication utilities

**Functions:**

##### `signUpWithEmail(email, password, attributes)`
```javascript
// Generates unique username: user_1704123456789_abc123
// Only sends: email, given_name, family_name to Cognito
// Returns: { success, user, userId, username, nextStep }
```

**Important:** Custom attributes (gender_id, profile_pic_url) are NOT sent to Cognito. They're stored in backend database only.

##### `confirmSignUpWithCode(emailOrUsername, code)`
```javascript
// Verifies 6-digit code sent to email
// Can accept either email OR username (due to alias config)
// Returns: { success, isSignUpComplete }
```

##### `signInWithEmail(email, password)`
```javascript
// Authenticates with Cognito
// Returns tokens: idToken, accessToken, refreshToken
// Returns: { success, user, token, accessToken, refreshToken, expiresAt }
```

##### Other Functions:
- `resendVerificationCode(email)` - Resend verification code
- `signOutUser()` - Sign out from Cognito
- `sendPasswordResetEmail(email)` - Initiate password reset
- `confirmPasswordReset(email, code, newPassword)` - Complete password reset
- `getAuthSession()` - Get current session (auto-refreshes)
- `getCurrentUserInfo()` - Get user attributes
- `isAuthenticated()` - Check if user is authenticated

---

#### 4. `app/shared/utils/cognitoTokenManager.js`
**Purpose:** Token management and backend synchronization

**Key Function:**

##### `syncUserWithBackend(userData, cognitoToken, isSignup)`
```javascript
// Syncs user data with main server after Cognito auth
// Sends: cognito_user_id, email, first_name, last_name, gender_id, profile_pic_url
// Authorization: Bearer <cognitoIdToken>
// Endpoint: /auth/signup (if isSignup=true) or /auth/login
```

**Other Functions:**
- `getAuthToken()` - Get ID token from Amplify (auto-refreshes)
- `getAccessToken()` - Get access token for AWS services
- `getUserInfo()` - Get cached user info from localStorage
- `clearAuthToken()` - Clear all auth data
- `isTokenValid()` - Check if user is authenticated
- `authenticatedFetch(url, options)` - Fetch with auto-token injection

**Token Refresh:**
Amplify automatically refreshes tokens when expired. No manual refresh logic needed!

---

#### 5. `app/features/auth/components/VerificationCode/index.jsx`
**Purpose:** Email verification UI component

**Features:**
- ✅ 6-digit code input with auto-focus
- ✅ Paste support (paste full code at once)
- ✅ Keyboard navigation (arrows, backspace, enter)
- ✅ Resend code with 60-second cooldown
- ✅ Success/error message display
- ✅ Dark/light theme matching login screen
- ✅ Responsive design for mobile

**Props:**
```javascript
<VerificationCode
  email={string}                // User email for display
  onVerify={async (code) => {}} // Callback when code submitted
  onResend={async () => {}}     // Callback to resend code
  onBack={() => {}}             // Callback to go back to signup
  isDarkTheme={boolean}         // Theme flag
/>
```

---

#### 6. `app/features/auth/components/VerificationCode/verification-code.css`
**Purpose:** Styling for verification component

**Design:**
- Matches login screen theme exactly
- Dark mode: `background: #1f1f1f`, card: `#181818`
- Large input boxes: `56px × 64px`, `32px` font size
- Gradient button matching login screen
- Responsive: smaller inputs on mobile (`48px × 56px`)

---

### Files Modified

#### 1. `app/index.js`
**Change:** Added Amplify initialization

```javascript
import { configureAmplify } from './shared/config/amplifyConfig.js';

// Initialize Amplify before rendering app
configureAmplify();

// ... rest of app initialization
```

**Why:** Amplify must be configured before any auth operations

---

#### 2. `app/features/auth/components/Login/index.jsx`
**Changes:** Complete refactor to use Cognito

##### Added State Fields:
```javascript
this.state = {
  // ... existing state
  firstName: '',              // Sign-up field
  lastName: '',               // Sign-up field
  genderId: '',               // Sign-up field (optional)
  pendingVerificationEmail: null,     // For verification screen
  pendingVerificationUsername: null,  // For Cognito confirmation
  pendingUserData: null,              // User data to pass after verification
  pendingPassword: null,              // To auto-login after verification
};
```

##### Sign-Up Form (NEW):
```javascript
{!isLogin && (
  <>
    <input
      type="text"
      placeholder="First Name *"
      value={firstName}
      onChange={(e) => this.setState({ firstName: e.target.value })}
      required
    />
    <input
      type="text"
      placeholder="Last Name *"
      value={lastName}
      onChange={(e) => this.setState({ lastName: e.target.value })}
      required
    />
    <select
      value={genderId}
      onChange={(e) => this.setState({ genderId: e.target.value })}
      className="form-select"
    >
      <option value="">Gender (Optional)</option>
      <option value="1">Male</option>
      <option value="2">Female</option>
      <option value="3">Other</option>
      <option value="4">Prefer not to say</option>
    </select>
  </>
)}
```

##### Sign-Up Flow:
```javascript
async handleEmailPasswordAuth() {
  if (!isLogin) {
    // 1. Sign up with Cognito
    const result = await signUpWithEmail(email, password, {
      firstName,
      lastName,
      genderId: parseInt(genderId) || null,
      profilePicUrl: null,
    });

    if (result.success) {
      if (result.nextStep === 'CONFIRM_SIGN_UP') {
        // 2. Show verification screen
        this.setState({
          currentView: 'verification',
          pendingVerificationEmail: email,
          pendingVerificationUsername: result.username, // ⚠️ Important!
          pendingUserData: result.user,
          pendingPassword: password,
        });
      }
    }
  } else {
    // Login flow
    await this.handleLogin();
  }
}
```

##### Verification Handlers:
```javascript
async handleVerifyCode(code) {
  const { pendingVerificationUsername, pendingVerificationEmail } = this.state;

  // ⚠️ Use username (not email) for confirmation
  const usernameOrEmail = pendingVerificationUsername || pendingVerificationEmail;

  const result = await confirmSignUpWithCode(usernameOrEmail, code);

  if (result.success) {
    await this.handlePostVerification();
    return { success: true };
  }
  return result;
}

async handlePostVerification() {
  const { pendingVerificationEmail, pendingPassword, pendingUserData } = this.state;

  // 1. Auto-login after verification
  const signInResult = await signInWithEmail(pendingVerificationEmail, pendingPassword);

  if (signInResult.success) {
    // 2. Sync with backend server
    const syncResult = await syncUserWithBackend(
      { ...signInResult.user, ...pendingUserData },
      signInResult.token,
      true // isSignup = true
    );

    if (syncResult.success) {
      // 3. Store tokens in localStorage
      const expiryTime = signInResult.expiresAt
        ? signInResult.expiresAt * 1000
        : Date.now() + (60 * 60 * 1000);

      localStorage.setItem('dbx_auth_token', signInResult.token);
      localStorage.setItem('dbx_refresh_token', signInResult.refreshToken || '');
      localStorage.setItem('dbx_token_expiry', expiryTime.toString());
      localStorage.setItem('dbx_token_type', 'cognito');
      localStorage.setItem('dbx_user_info', JSON.stringify(syncResult.user));

      // 4. Reload app
      setTimeout(() => window.location.reload(), 1500);
    }
  }
}
```

##### Login Flow:
```javascript
async handleLogin() {
  const { email, password } = this.state;

  // 1. Sign in with Cognito
  const result = await signInWithEmail(email, password);

  if (result.success) {
    // 2. Sync with backend server
    const syncResult = await syncUserWithBackend(
      result.user,
      result.token,
      false // isSignup = false
    );

    if (syncResult.success) {
      // 3. Store tokens in localStorage
      const expiryTime = result.expiresAt
        ? result.expiresAt * 1000
        : Date.now() + (60 * 60 * 1000);

      localStorage.setItem('dbx_auth_token', result.token);
      localStorage.setItem('dbx_refresh_token', result.refreshToken || '');
      localStorage.setItem('dbx_token_expiry', expiryTime.toString());
      localStorage.setItem('dbx_token_type', 'cognito');
      localStorage.setItem('dbx_user_info', JSON.stringify(syncResult.user));

      // 4. Reload app
      setTimeout(() => window.location.reload(), 1500);
    }
  }
}
```

##### Render Verification Screen:
```javascript
render() {
  const { currentView, pendingVerificationEmail, theme } = this.state;

  if (currentView === 'verification') {
    return (
      <VerificationCode
        email={pendingVerificationEmail}
        onVerify={this.handleVerifyCode}
        onResend={this.handleResendCode}
        onBack={this.goBackToOptions}
        isDarkTheme={theme === 'dark'}
      />
    );
  }

  // ... rest of render
}
```

---

#### 3. `app/features/ai/components/UnifiedAISettings/index.jsx`
**Change:** Updated to use centralized server config

```javascript
// Before:
const MAIN_SERVER_ENDPOINT = 'https://fp9waphqm5.us-east-1.awsapprunner.com/api/v1';

// After:
import { MAIN_SERVER_ENDPOINT } from '../../../../shared/constants/serverConfig.js';
```

---

#### 4. `app/shared/utils/authTokenManager.js`
**Change:** Updated to use AUTH_ENDPOINTS from serverConfig

```javascript
// Before:
const refreshEndpoint = 'https://fp9waphqm5.us-east-1.awsapprunner.com/api/v1/auth/refresh';

// After:
import { AUTH_ENDPOINTS } from '../constants/serverConfig.js';
const response = await fetch(AUTH_ENDPOINTS.REFRESH, { ... });
```

---

## Architecture

### Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          SIGN UP FLOW                           │
└─────────────────────────────────────────────────────────────────┘

User fills form
  ↓
[firstName, lastName, email, password, gender_id]
  ↓
signUpWithEmail()
  ↓
Generate unique username: user_1234567890_abc123
  ↓
Cognito.signUp({ username, password, userAttributes: { email, given_name, family_name } })
  ↓
⚠️ ONLY email, given_name, family_name sent to Cognito
⚠️ gender_id, profile_pic_url stored for later
  ↓
Cognito sends 6-digit code to email
  ↓
Show VerificationCode component
  ↓
User enters code
  ↓
confirmSignUpWithCode(username, code) ⚠️ Use username, not email!
  ↓
Auto-login: signInWithEmail(email, password)
  ↓
Get tokens: { idToken, accessToken, refreshToken, expiresAt }
  ↓
syncUserWithBackend(userData, idToken, isSignup=true)
  ↓
POST /auth/signup
Headers: { Authorization: "Bearer <idToken>" }
Body: { cognito_user_id, email, first_name, last_name, gender_id, profile_pic_url }
  ↓
Backend verifies Cognito token, creates user in DB
  ↓
Store in localStorage:
  - dbx_auth_token: idToken
  - dbx_refresh_token: refreshToken
  - dbx_token_expiry: expiresAt * 1000
  - dbx_token_type: "cognito"
  - dbx_user_info: JSON.stringify(user)
  ↓
Reload app → User authenticated ✅


┌─────────────────────────────────────────────────────────────────┐
│                          SIGN IN FLOW                           │
└─────────────────────────────────────────────────────────────────┘

User enters email + password
  ↓
signInWithEmail(email, password)
  ↓
Cognito.signIn({ username: email, password })
  ↓
Get tokens: { idToken, accessToken, refreshToken, expiresAt }
  ↓
syncUserWithBackend(userData, idToken, isSignup=false)
  ↓
POST /auth/login
Headers: { Authorization: "Bearer <idToken>" }
Body: { cognito_user_id, email }
  ↓
Backend verifies Cognito token, retrieves user from DB
  ↓
Store in localStorage (same as sign-up)
  ↓
Reload app → User authenticated ✅


┌─────────────────────────────────────────────────────────────────┐
│                      TOKEN REFRESH FLOW                         │
└─────────────────────────────────────────────────────────────────┘

App makes API request
  ↓
authenticatedFetch(url, options)
  ↓
getAuthToken() → Amplify.fetchAuthSession()
  ↓
Amplify checks token expiry
  ↓
If expired: Amplify automatically refreshes using refreshToken
  ↓
Return fresh idToken ✅
  ↓
Continue API request with fresh token
```

---

## Implementation Details

### 1. Username vs Email in Cognito

**Problem:** Cognito User Pool configured with "email as alias"

**What this means:**
- User can sign in with email (email becomes an alias)
- But username MUST be unique and NOT in email format
- Username != Email

**Solution:**
```javascript
// Generate unique username on signup
const username = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
// Example: user_1704123456789_abc123

// Sign up with generated username
await signUp({ username, password, userAttributes: { email } });

// Store username for verification
this.setState({ pendingVerificationUsername: result.username });

// Use username for confirmation (NOT email)
await confirmSignUp({ username, confirmationCode });

// User can now sign in with email (alias works)
await signIn({ username: email, password });
```

**⚠️ Critical:** Must use `username` for `confirmSignUp`, but can use `email` for `signIn`.

---

### 2. Custom Attributes Strategy

**Decision:** Do NOT send custom attributes to Cognito

**Reason:**
- Custom attributes require User Pool configuration
- Custom attributes cannot be deleted once created
- Easier to manage in your own database

**Implementation:**
```javascript
// On signup - only send standard attributes to Cognito
const userAttributes = { email };
if (firstName) userAttributes.given_name = firstName;
if (lastName) userAttributes.family_name = lastName;

await signUp({ username, password, options: { userAttributes } });

// After verification - send ALL attributes to backend
await syncUserWithBackend({
  cognito_user_id: userId,
  email,
  first_name: firstName,
  last_name: lastName,
  gender_id: parseInt(genderId),      // ← Stored in your DB
  profile_pic_url: profilePicUrl,      // ← Stored in your DB
}, cognitoToken, true);
```

**Backend receives:**
```json
{
  "cognito_user_id": "abc123-def456-...",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "gender_id": 1,
  "profile_pic_url": null
}
```

---

### 3. Token Storage Format

**Format:** Matches existing app expectations

```javascript
localStorage.setItem('dbx_auth_token', idToken);        // ID token for backend auth
localStorage.setItem('dbx_refresh_token', refreshToken); // Refresh token (Amplify manages)
localStorage.setItem('dbx_token_expiry', timestamp);     // Expiry in milliseconds
localStorage.setItem('dbx_token_type', 'cognito');       // Auth provider identifier
localStorage.setItem('dbx_user_info', JSON.stringify(user)); // User data object
```

**Token Types:**
- **ID Token** (`idToken`): JWT for backend authentication, contains user claims
- **Access Token** (`accessToken`): For AWS service access (not needed for backend)
- **Refresh Token** (`refreshToken`): Long-lived token for automatic refresh

**Expiry Handling:**
```javascript
// Convert Cognito expiry (seconds) to milliseconds
const expiryTime = signInResult.expiresAt
  ? signInResult.expiresAt * 1000  // Unix timestamp in seconds → ms
  : Date.now() + (60 * 60 * 1000); // Default: 1 hour
```

---

### 4. Automatic Token Refresh

**Amplify Magic:** Tokens refresh automatically!

```javascript
// Just call fetchAuthSession - Amplify handles expiry
const session = await fetchAuthSession();
const idToken = session.tokens?.idToken?.toString();

// If token expired:
// 1. Amplify checks expiry
// 2. Amplify uses refreshToken to get new tokens
// 3. Amplify returns fresh tokens
// 4. No manual refresh logic needed! ✨
```

**In `cognitoTokenManager.js`:**
```javascript
export async function getAuthToken() {
  try {
    const session = await fetchAuthSession(); // Auto-refreshes
    return session.tokens?.idToken?.toString();
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}
```

**No need for:**
- Manual expiry checks
- Refresh API calls to backend
- Token refresh timers
- Token refresh error handling

---

### 5. Backend Synchronization

**Two-stage authentication:**

1. **Cognito Authentication** (AWS managed)
   - Validates credentials
   - Issues JWT tokens
   - Handles MFA, password policies, etc.

2. **Backend Synchronization** (Your server)
   - Verifies Cognito JWT token
   - Creates/updates user in your database
   - Returns user data with your custom fields
   - Manages app-specific logic

**Flow:**
```javascript
// Stage 1: Authenticate with Cognito
const cognitoResult = await signInWithEmail(email, password);
// Returns: { success: true, token: "<JWT>", user: {...} }

// Stage 2: Sync with backend
const syncResult = await syncUserWithBackend(
  cognitoResult.user,
  cognitoResult.token, // Send as Bearer token
  false // isSignup
);
// Backend verifies JWT, returns user data

// Store both Cognito tokens AND backend user data
localStorage.setItem('dbx_auth_token', cognitoResult.token);
localStorage.setItem('dbx_user_info', JSON.stringify(syncResult.user));
```

**Why two stages?**
- Cognito manages authentication (security)
- Your backend manages application data (flexibility)
- Can add custom business logic in backend
- Can store additional user attributes in your database

---

## Edge Cases & Solutions

### Edge Case 1: "Username cannot be of email format"

**Error:**
```json
{
  "__type": "InvalidParameterException",
  "message": "Username cannot be of email format, since user pool is configured for email alias."
}
```

**Cause:** Cognito User Pool has "email as alias" enabled, so username must NOT be in email format.

**Solution:** Generate unique username
```javascript
const username = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
await signUp({ username, password, ... });
```

---

### Edge Case 2: "Attributes did not conform to schema"

**Error:**
```json
{
  "__type": "InvalidParameterException",
  "message": "Attributes did not conform to the schema: custom:gender_id"
}
```

**Cause:** Custom attributes not created in Cognito User Pool.

**Solution:** Don't send custom attributes to Cognito
```javascript
// ❌ Don't do this:
const userAttributes = {
  email,
  'custom:gender_id': 1,  // Error!
};

// ✅ Do this:
const userAttributes = { email, given_name, family_name };
// Store custom attributes in backend after signup
```

---

### Edge Case 3: "Invalid code provided" / "ExpiredCodeException"

**Error:**
```json
{
  "__type": "ExpiredCodeException",
  "message": "Invalid code provided, please request a code again."
}
```

**Cause:** Using email for confirmation instead of username.

**Solution:** Use username for confirmation
```javascript
// ❌ Wrong:
await confirmSignUp({
  username: email,  // Using email
  confirmationCode: code,
});

// ✅ Correct:
await confirmSignUp({
  username: generatedUsername,  // Using generated username
  confirmationCode: code,
});
```

**In Login component:**
```javascript
// Store username on signup
const result = await signUpWithEmail(...);
this.setState({
  pendingVerificationUsername: result.username,  // ← Store this!
  pendingVerificationEmail: email,
});

// Use username for confirmation
const { pendingVerificationUsername } = this.state;
await confirmSignUpWithCode(pendingVerificationUsername, code);
```

---

### Edge Case 4: Authentication Not Persisting

**Symptom:**
```javascript
console.log('authToken:', authToken);        // null
console.log('userInfo:', userInfo);          // { user_id: 75, ... }
console.log('isAuthenticated:', isAuth);     // false
```

**Cause:** Tokens stored in wrong localStorage keys, or missing token storage.

**Solution:** Store tokens in expected format
```javascript
// Both signup AND login must store tokens:
localStorage.setItem('dbx_auth_token', result.token);
localStorage.setItem('dbx_refresh_token', result.refreshToken || '');
localStorage.setItem('dbx_token_expiry', expiryTime.toString());
localStorage.setItem('dbx_token_type', 'cognito');
localStorage.setItem('dbx_user_info', JSON.stringify(syncResult.user));
```

**Check:**
```javascript
// Verify tokens are stored
console.log('Token stored:', localStorage.getItem('dbx_auth_token'));
console.log('Expiry stored:', localStorage.getItem('dbx_token_expiry'));
```

---

### Edge Case 5: Theme Mismatch in Verification Screen

**Issue:** Verification screen doesn't match login screen theme.

**Solution:** Match CSS values exactly
```css
/* Login screen dark theme */
.login-container.dark {
  background: #1f1f1f;
}
.login-card.dark {
  background: #181818;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0px 60px #292a2b;
}

/* Verification screen - MUST MATCH */
.verification-code-container.dark {
  background: #1f1f1f;  /* Same */
}
.verification-code-card.dark {
  background: #181818;  /* Same */
  border: 1px solid rgba(255, 255, 255, 0.1);  /* Same */
  box-shadow: 0 0px 60px #292a2b;  /* Same */
}
```

---

### Edge Case 6: Code Resend Spam Prevention

**Issue:** User can spam "Resend Code" button.

**Solution:** Implement cooldown timer
```javascript
const [resendCooldown, setResendCooldown] = useState(0);

const handleResend = async () => {
  if (resendCooldown > 0) return;

  const result = await onResend();

  if (result.success) {
    setResendCooldown(60); // 60 second cooldown
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }
};

// Button disabled during cooldown
<button disabled={resendCooldown > 0}>
  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
</button>
```

---

### Edge Case 7: Password Not Meeting Requirements

**Error:** Cognito rejects password silently or with generic error.

**Requirements (from amplifyConfig):**
```javascript
passwordFormat: {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialCharacters: false,
}
```

**Solution:** Add frontend validation
```javascript
function validatePassword(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain number';
  }
  return null; // Valid
}

// In handleEmailPasswordAuth:
const passwordError = validatePassword(password);
if (passwordError) {
  this.setErrorWithTimeout(passwordError);
  return;
}
```

---

## Testing Guide

### Manual Testing Checklist

#### Sign-Up Flow
- [ ] Fill all required fields (first name, last name, email, password)
- [ ] Select optional gender field
- [ ] Click "Sign Up"
- [ ] Verify code sent to email
- [ ] Check email for 6-digit code
- [ ] Enter code in verification screen
- [ ] Verify auto-login after verification
- [ ] Verify redirect to main app
- [ ] Check localStorage for tokens
- [ ] Verify user data in backend database

#### Sign-In Flow
- [ ] Enter existing email and password
- [ ] Click "Sign In"
- [ ] Verify successful login
- [ ] Verify redirect to main app
- [ ] Check localStorage for tokens
- [ ] Verify token stored correctly

#### Token Persistence
- [ ] Login successfully
- [ ] Refresh page
- [ ] Verify still authenticated (no login screen)
- [ ] Check `dbx_auth_token` in localStorage
- [ ] Verify token expiry timestamp

#### Token Refresh
- [ ] Wait for token to expire (or manually expire)
- [ ] Make API request
- [ ] Verify token auto-refreshes
- [ ] Verify API request succeeds with new token

#### Verification Code
- [ ] Request verification code
- [ ] Check email received
- [ ] Copy full code and paste → should auto-fill
- [ ] Try typing individual digits
- [ ] Use arrow keys to navigate between inputs
- [ ] Use backspace to clear and move back
- [ ] Press Enter to submit code

#### Resend Code
- [ ] Request verification code
- [ ] Click "Resend Code"
- [ ] Verify 60-second cooldown
- [ ] Verify new code received in email
- [ ] Verify new code works

#### Password Reset
- [ ] Click "Forgot Password"
- [ ] Enter email
- [ ] Check email for reset code
- [ ] Enter code and new password
- [ ] Verify can login with new password

#### Error Handling
- [ ] Try signing up with existing email → should show error
- [ ] Try signing in with wrong password → should show error
- [ ] Try invalid verification code → should show error
- [ ] Try expired verification code → should show error
- [ ] Try weak password → should show error

#### Theme Testing
- [ ] Switch to dark theme
- [ ] Verify login screen dark theme
- [ ] Verify verification screen matches dark theme
- [ ] Switch to light theme
- [ ] Verify both screens match light theme

---

### Testing with Console

#### Check Authentication Status
```javascript
// Open browser console
console.log('Auth Token:', localStorage.getItem('dbx_auth_token'));
console.log('Refresh Token:', localStorage.getItem('dbx_refresh_token'));
console.log('Token Expiry:', new Date(parseInt(localStorage.getItem('dbx_token_expiry'))));
console.log('User Info:', JSON.parse(localStorage.getItem('dbx_user_info')));
```

#### Test Token Refresh
```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

// Get current session
const session = await fetchAuthSession();
console.log('ID Token:', session.tokens?.idToken?.toString());
console.log('Expires At:', new Date(session.tokens?.idToken?.payload?.exp * 1000));
```

#### Test Backend Sync
```javascript
// Test signup endpoint
const response = await fetch('http://localhost:8000/api/v1/auth/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('dbx_auth_token')}`
  },
  body: JSON.stringify({
    cognito_user_id: 'test-user-id',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    gender_id: 1,
    profile_pic_url: null
  })
});
console.log('Response:', await response.json());
```

---

## Troubleshooting

### Issue: "User Pool not found"

**Symptoms:**
```
Error: User Pool not found
```

**Causes:**
1. Wrong User Pool ID in config
2. Wrong AWS region
3. User Pool doesn't exist

**Solutions:**
```javascript
// Check amplifyConfig.js
console.log('User Pool ID:', process.env.COGNITO_USER_POOL_ID || 'us-east-1_jttIzc3Av');

// Verify region matches User Pool region
// User Pool ID format: {region}_{id}
// Example: us-east-1_jttIzc3Av → region is us-east-1
```

---

### Issue: "Invalid client ID"

**Symptoms:**
```
Error: Invalid client ID
```

**Causes:**
1. Wrong App Client ID in config
2. App Client doesn't exist
3. App Client disabled

**Solutions:**
1. Check AWS Console > Cognito > User Pool > App Integration > App Clients
2. Verify Client ID matches `amplifyConfig.js`
3. Ensure "ALLOW_USER_PASSWORD_AUTH" is enabled

---

### Issue: Verification code not received

**Possible causes:**
1. Email in spam folder
2. Cognito email sending limit reached
3. SES (Simple Email Service) not verified (for production)

**Solutions:**
1. Check spam/junk folder
2. For development: AWS account has SES sandbox limits (200 emails/day)
3. For production: Request SES production access
4. Test with AWS Console: Cognito > User Pool > Users > Resend Confirmation

---

### Issue: Token refresh fails

**Symptoms:**
```
Error: Unable to refresh token
```

**Causes:**
1. Refresh token expired (default: 30 days)
2. User signed out
3. Refresh token revoked

**Solutions:**
```javascript
// Check if user is still authenticated
import { getCurrentUser } from 'aws-amplify/auth';

try {
  const user = await getCurrentUser();
  console.log('User still authenticated:', user);
} catch (error) {
  console.log('User not authenticated, need to login again');
  // Redirect to login
}
```

---

### Issue: Backend returns 401 Unauthorized

**Symptoms:**
- Frontend authenticated successfully
- Backend rejects requests with 401

**Causes:**
1. Backend not verifying Cognito JWT correctly
2. Token expired and not refreshed
3. Wrong token sent to backend

**Solutions:**

**Check token being sent:**
```javascript
const token = localStorage.getItem('dbx_auth_token');
console.log('Token:', token);

// Decode JWT (just for debugging - don't verify signature here)
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log('Token payload:', payload);
console.log('Token expires:', new Date(payload.exp * 1000));
```

**Verify backend JWT verification** (see Backend Requirements section)

---

### Issue: "NotAuthorizedException: Incorrect username or password"

**Causes:**
1. Wrong email/password
2. User not confirmed yet
3. User disabled in Cognito

**Solutions:**
```javascript
// Check user confirmation status in AWS Console
// Cognito > User Pool > Users > Find user > Check "Confirmation status"

// If user is "UNCONFIRMED", resend confirmation code
import { resendSignUpCode } from 'aws-amplify/auth';
await resendSignUpCode({ username: email });
```

---

## Backend Requirements

### JWT Token Verification

Your backend MUST verify Cognito JWT tokens. Here's how:

#### Node.js Backend (Express)

**Install dependencies:**
```bash
npm install aws-jwt-verify
```

**Verify token middleware:**
```javascript
const { CognitoJwtVerifier } = require('aws-jwt-verify');

// Create verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: 'us-east-1_jttIzc3Av',
  clientId: '58n2mqt76oqjpau29jbo07bnbl',
  tokenUse: 'id', // Verify ID token (not access token)
});

// Middleware
async function verifyCognitoToken(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const payload = await verifier.verify(token);

    // Attach user info to request
    req.user = {
      cognitoUserId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Use middleware
app.use('/api/v1/auth/*', verifyCognitoToken);
```

---

#### Python Backend (Flask/FastAPI)

**Install dependencies:**
```bash
pip install python-jose[cryptography] requests
```

**Verify token:**
```python
import requests
from jose import jwt, JWTError

COGNITO_REGION = 'us-east-1'
USER_POOL_ID = 'us-east-1_jttIzc3Av'
APP_CLIENT_ID = '58n2mqt76oqjpau29jbo07bnbl'
KEYS_URL = f'https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json'

# Cache JWKS keys
jwks_keys = None

def get_jwks_keys():
    global jwks_keys
    if not jwks_keys:
        response = requests.get(KEYS_URL)
        jwks_keys = response.json()['keys']
    return jwks_keys

def verify_cognito_token(token):
    try:
        # Get signing key
        keys = get_jwks_keys()
        headers = jwt.get_unverified_headers(token)
        key = next((k for k in keys if k['kid'] == headers['kid']), None)

        if not key:
            raise Exception('Public key not found')

        # Verify token
        payload = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=APP_CLIENT_ID,
            issuer=f'https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}'
        )

        return {
            'cognitoUserId': payload['sub'],
            'email': payload['email'],
            'firstName': payload.get('given_name'),
            'lastName': payload.get('family_name'),
        }
    except JWTError as e:
        raise Exception(f'Token verification failed: {str(e)}')

# Flask middleware
from flask import request, jsonify

@app.before_request
def verify_token():
    if request.path.startswith('/api/v1/auth/'):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401

        token = auth_header.replace('Bearer ', '')
        try:
            user = verify_cognito_token(token)
            request.user = user
        except Exception as e:
            return jsonify({'error': str(e)}), 401
```

---

### Backend API Endpoints

#### POST `/api/v1/auth/signup`

**Purpose:** Create new user in database after Cognito signup

**Headers:**
```
Authorization: Bearer <cognito_id_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "cognito_user_id": "abc123-def456-...",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "gender_id": 1,
  "profile_pic_url": null
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "user_id": 123,
    "cognito_user_id": "abc123-def456-...",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "gender_id": 1,
    "profile_pic_url": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Backend Logic:**
1. Verify Cognito JWT token
2. Extract `cognito_user_id` from token (`sub` claim)
3. Check if user already exists (by `cognito_user_id` or `email`)
4. If exists: return existing user
5. If new: create user in database
6. Return user object

---

#### POST `/api/v1/auth/login`

**Purpose:** Retrieve existing user from database after Cognito login

**Headers:**
```
Authorization: Bearer <cognito_id_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "cognito_user_id": "abc123-def456-...",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "user_id": 123,
    "cognito_user_id": "abc123-def456-...",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "gender_id": 1,
    "profile_pic_url": "https://example.com/photo.jpg",
    "last_login": "2024-01-01T00:00:00Z"
  }
}
```

**Backend Logic:**
1. Verify Cognito JWT token
2. Extract `cognito_user_id` from token
3. Find user in database by `cognito_user_id`
4. Update `last_login` timestamp
5. Return user object

---

#### POST `/api/v1/auth/refresh`

**Purpose:** (Optional) Not needed if using Amplify's auto-refresh

**Note:** Amplify handles token refresh automatically. This endpoint is only needed if you want custom refresh logic.

---

### Database Schema

**Add `cognito_user_id` column to users table:**

```sql
ALTER TABLE users ADD COLUMN cognito_user_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_cognito_user_id ON users(cognito_user_id);
```

**Full schema example:**
```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  gender_id INT,
  profile_pic_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_cognito_user_id (cognito_user_id)
);
```

---

## Migration Checklist

### Pre-Migration
- [x] Install AWS Amplify packages (`yarn add aws-amplify @aws-amplify/ui-react`)
- [x] Create Cognito User Pool in AWS Console
- [x] Get User Pool ID and Client ID
- [x] Configure Amplify in app
- [x] Create authentication utilities
- [x] Create verification UI component

### Code Changes
- [x] Update server URL configuration
- [x] Replace Firebase auth with Cognito auth
- [x] Add sign-up form fields (first_name, last_name, gender_id)
- [x] Implement verification code screen
- [x] Add token storage in localStorage
- [x] Update login flow to use Cognito
- [x] Remove Firebase dependencies (optional)

### Backend Changes
- [ ] Add JWT token verification middleware
- [ ] Update `/auth/signup` endpoint to accept Cognito tokens
- [ ] Update `/auth/login` endpoint to accept Cognito tokens
- [ ] Add `cognito_user_id` column to users table
- [ ] Test token verification
- [ ] Deploy backend changes

### Testing
- [ ] Test sign-up flow end-to-end
- [ ] Test email verification
- [ ] Test login flow
- [ ] Test token persistence across page reloads
- [ ] Test token refresh (wait for expiry)
- [ ] Test password reset flow
- [ ] Test error cases (wrong password, invalid code, etc.)
- [ ] Test on different browsers
- [ ] Test on mobile devices

### Production Deployment
- [ ] Set environment variables (if not hardcoded)
- [ ] Configure SES for production email sending (if needed)
- [ ] Enable MFA (optional but recommended)
- [ ] Set up CloudWatch alarms for Cognito metrics
- [ ] Monitor authentication errors
- [ ] Plan for Firebase user migration (if applicable)

---

## Summary

### What Works ✅
- Sign up with email, password, first name, last name, gender
- Email verification with 6-digit code
- Auto-login after verification
- Backend synchronization with Cognito token
- Token storage in localStorage
- Login with email and password
- Automatic token refresh via Amplify
- Dark/light theme support
- Password reset flow (implemented in cognitoAuth.js)

### What's Not Included ❌
- Google OAuth sign-in (can be added with Cognito Hosted UI)
- Phone number verification
- MFA (Multi-Factor Authentication)
- User profile updates
- Delete account functionality
- Admin user management UI

### Known Limitations ⚠️
- Custom attributes (gender_id, profile_pic_url) not stored in Cognito
- Username is auto-generated (not user-facing)
- Requires backend to be running on localhost:8000
- Requires backend to verify Cognito JWT tokens
- Email sending limited in SES sandbox (200/day for new AWS accounts)

---

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [JWT Token Verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [Amplify Auth API Reference](https://docs.amplify.aws/javascript/build-a-backend/auth/)

---

## Contact & Support

For issues or questions:
1. Check this documentation first
2. Check AWS Amplify error messages in browser console
3. Check Cognito User Pool logs in AWS Console
4. Review code comments in `cognitoAuth.js` and `cognitoTokenManager.js`

---

**Last Updated:** January 2024
**Amplify Version:** 6.15.10
**Cognito User Pool:** us-east-1_jttIzc3Av

# AWS Cognito Migration - Remaining Steps

## Overview

This document outlines the remaining steps to complete the AWS Cognito migration for the DBX Studio project. The migration will replace Firebase authentication with AWS Cognito, using `localhost:8000` as the main server endpoint.

**Current Status**: Core infrastructure created ✅

## AWS Cognito Configuration

```
User Pool ID: us-east-1_jttIzc3Av
Client ID: 58n2mqt76oqjpau29jbo07bnbl
Region: us-east-1
Main Server: http://localhost:8000
```

---

## ✅ Completed Steps

### 1. Core Infrastructure Created

- ✅ Created [serverConfig.ts](apps/web/src/shared/constants/serverConfig.ts) for web app
- ✅ Created [serverConfig.ts](apps/desktop/src/shared/constants/serverConfig.ts) for desktop app
- ✅ Created [amplifyConfig.ts](apps/web/src/shared/config/amplifyConfig.ts) for web app
- ✅ Created [amplifyConfig.ts](apps/desktop/src/shared/config/amplifyConfig.ts) for desktop app
- ✅ Created [cognitoAuth.ts](apps/web/src/shared/utils/cognitoAuth.ts) for web app
- ✅ Created [cognitoAuth.ts](apps/desktop/src/shared/utils/cognitoAuth.ts) for desktop app
- ✅ Created [cognitoTokenManager.ts](apps/web/src/shared/utils/cognitoTokenManager.ts) for web app
- ✅ Created [cognitoTokenManager.ts](apps/desktop/src/shared/utils/cognitoTokenManager.ts) for desktop app

### 2. Updated Existing Files

- ✅ Updated [authTokenManager.ts](apps/web/src/shared/utils/authTokenManager.ts) to support Cognito tokens
- ✅ Updated [authTokenManager.ts](apps/desktop/src/shared/utils/authTokenManager.ts) to support Cognito tokens
- ✅ Updated [useConnections.ts](apps/web/src/shared/hooks/useConnections.ts) to use localhost:8000
- ✅ Updated [useConnections.ts](apps/desktop/src/shared/hooks/useConnections.ts) to use localhost:8000
- ✅ Updated [.env.example](apps/web/.env.example) with Cognito configuration
- ✅ Updated [.env.example](apps/desktop/.env.example) with Cognito configuration

---

## 📋 Remaining Steps

### Step 1: Install AWS Amplify Dependencies

Install AWS Amplify packages in both web and desktop apps:

```bash
# For web app
cd apps/web
npm install aws-amplify

# For desktop app
cd apps/desktop
npm install aws-amplify
```

### Step 2: Initialize Amplify in Application Entry Points

#### Web App

Edit [apps/web/src/main.tsx](apps/web/src/main.tsx) or the main entry file:

```typescript
import { configureAmplify } from './shared/config/amplifyConfig'

// Initialize Amplify before rendering app
configureAmplify()

// Rest of your app initialization...
```

#### Desktop App

Edit [apps/desktop/src/main.tsx](apps/desktop/src/main.tsx) or the main entry file:

```typescript
import { configureAmplify } from './shared/config/amplifyConfig'

// Initialize Amplify before rendering app
configureAmplify()

// Rest of your app initialization...
```

### Step 3: Create Verification Code Component

Create a verification code component for email verification (6-digit code input):

#### Web App: `apps/web/src/features/auth/components/VerificationCode/index.tsx`

```tsx
import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react'
import './VerificationCode.css'

interface VerificationCodeProps {
  email: string
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>
  onResend: () => Promise<{ success: boolean; error?: string }>
  onBack: () => void
  isDarkTheme?: boolean
}

export function VerificationCode({
  email,
  onVerify,
  onResend,
  onBack,
  isDarkTheme = false,
}: VerificationCodeProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split('')
      const newCode = [...code]
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit
        }
      })
      setCode(newCode)
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    } else if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('')
    const newCode = [...code]
    digits.forEach((digit, i) => {
      newCode[i] = digit
    })
    setCode(newCode)
    inputRefs.current[Math.min(digits.length, 5)]?.focus()
  }

  const handleSubmit = async () => {
    const verificationCode = code.join('')
    if (verificationCode.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter all 6 digits' })
      return
    }

    setIsVerifying(true)
    setMessage(null)

    const result = await onVerify(verificationCode)

    setIsVerifying(false)

    if (!result.success) {
      setMessage({ type: 'error', text: result.error || 'Verification failed' })
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return

    const result = await onResend()

    if (result.success) {
      setMessage({ type: 'success', text: 'Verification code sent!' })
      setResendCooldown(60)

      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to resend code' })
    }
  }

  return (
    <div className={`verification-code-container ${isDarkTheme ? 'dark' : ''}`}>
      <div className={`verification-code-card ${isDarkTheme ? 'dark' : ''}`}>
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>

        <h2>Verify Your Email</h2>
        <p className="instruction">
          We've sent a 6-digit code to <strong>{email}</strong>
        </p>

        <div className="code-inputs">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="code-input"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {message && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <button
          className="verify-button"
          onClick={handleSubmit}
          disabled={isVerifying || code.join('').length !== 6}
        >
          {isVerifying ? 'Verifying...' : 'Verify Email'}
        </button>

        <button
          className="resend-button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0
            ? `Resend code (${resendCooldown}s)`
            : 'Resend code'}
        </button>
      </div>
    </div>
  )
}
```

#### Web App: `apps/web/src/features/auth/components/VerificationCode/VerificationCode.css`

```css
.verification-code-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 20px;
}

.verification-code-container.dark {
  background: #1f1f1f;
}

.verification-code-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  position: relative;
}

.verification-code-card.dark {
  background: #181818;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0px 60px #292a2b;
}

.back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  padding: 8px;
}

.back-button:hover {
  color: #000;
}

.verification-code-card.dark .back-button {
  color: #999;
}

.verification-code-card.dark .back-button:hover {
  color: #fff;
}

.verification-code-card h2 {
  margin: 0 0 16px;
  font-size: 28px;
  text-align: center;
}

.verification-code-card.dark h2 {
  color: #fff;
}

.instruction {
  text-align: center;
  color: #666;
  margin-bottom: 32px;
}

.verification-code-card.dark .instruction {
  color: #999;
}

.code-inputs {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.code-input {
  width: 56px;
  height: 64px;
  font-size: 32px;
  text-align: center;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.code-input:focus {
  border-color: #4f46e5;
}

.verification-code-card.dark .code-input {
  background: #242424;
  border-color: #333;
  color: #fff;
}

.verification-code-card.dark .code-input:focus {
  border-color: #6366f1;
}

.message {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: center;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
}

.verify-button,
.resend-button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.verify-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-bottom: 12px;
}

.verify-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.verify-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resend-button {
  background: transparent;
  color: #4f46e5;
  border: 1px solid #4f46e5;
}

.resend-button:hover:not(:disabled) {
  background: #f5f3ff;
}

.resend-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.verification-code-card.dark .resend-button {
  color: #818cf8;
  border-color: #818cf8;
}

.verification-code-card.dark .resend-button:hover:not(:disabled) {
  background: #1e1b4b;
}

@media (max-width: 640px) {
  .code-input {
    width: 48px;
    height: 56px;
    font-size: 28px;
  }

  .code-inputs {
    gap: 8px;
  }
}
```

Repeat the same component creation for the desktop app.

### Step 4: Update Login Components

Both [apps/web/src/features/auth/components/Login/index.tsx](apps/web/src/features/auth/components/Login/index.tsx) and [apps/desktop/src/features/auth/components/Login/index.tsx](apps/desktop/src/features/auth/components/Login/index.tsx) need to be updated to use Cognito instead of Firebase.

#### Key Changes Needed:

1. **Import Cognito utilities instead of Firebase:**

```typescript
// Replace:
import { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordResetEmail } from '../../../../shared/utils/firebase'

// With:
import {
  signUpWithEmail,
  confirmSignUpWithCode,
  signInWithEmail,
  resendVerificationCode,
  sendPasswordResetEmail,
  confirmPasswordReset,
} from '../../shared/utils/cognitoAuth'
import { syncUserWithBackend } from '../../shared/utils/cognitoTokenManager'
import { MAIN_SERVER_ENDPOINT } from '../../shared/constants/serverConfig'
```

2. **Add signup form fields:**

Add state for first name, last name, and gender:

```typescript
const [firstName, setFirstName] = useState('')
const [lastName, setLastName] = useState('')
const [genderId, setGenderId] = useState('')
const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
const [pendingVerificationUsername, setPendingVerificationUsername] = useState<string | null>(null)
const [pendingUserData, setPendingUserData] = useState<any>(null)
const [pendingPassword, setPendingPassword] = useState<string | null>(null)
```

3. **Update the signup handler:**

```typescript
const handleEmailPasswordAuth = async () => {
  if (!isLogin) {
    // Signup flow
    const result = await signUpWithEmail(email, password, {
      firstName,
      lastName,
      genderId: genderId ? parseInt(genderId) : null,
      profilePicUrl: null,
    })

    if (result.success) {
      if (result.nextStep === 'CONFIRM_SIGN_UP') {
        setCurrentView('verification')
        setPendingVerificationEmail(email)
        setPendingVerificationUsername(result.username) // Important!
        setPendingUserData(result.user)
        setPendingPassword(password)
      }
    } else {
      setErrorMessage(result.error || 'Sign up failed')
    }
  } else {
    // Login flow
    await handleLogin()
  }
}
```

4. **Add verification handlers:**

```typescript
const handleVerifyCode = async (code: string) => {
  const result = await confirmSignUpWithCode(
    pendingVerificationUsername || pendingVerificationEmail!,
    code
  )

  if (result.success) {
    await handlePostVerification()
    return { success: true }
  }

  return result
}

const handlePostVerification = async () => {
  // Auto-login after verification
  const signInResult = await signInWithEmail(pendingVerificationEmail!, pendingPassword!)

  if (signInResult.success) {
    // Sync with backend
    const syncResult = await syncUserWithBackend(
      { ...signInResult.user, ...pendingUserData },
      signInResult.token!,
      true // isSignup
    )

    if (syncResult.success) {
      // Store tokens in localStorage
      const expiryTime = signInResult.expiresAt
        ? signInResult.expiresAt * 1000
        : Date.now() + 60 * 60 * 1000

      localStorage.setItem('dbx_auth_token', signInResult.token!)
      localStorage.setItem('dbx_refresh_token', signInResult.refreshToken || '')
      localStorage.setItem('dbx_token_expiry', expiryTime.toString())
      localStorage.setItem('dbx_token_type', 'cognito')
      localStorage.setItem('dbx_user_info', JSON.stringify(syncResult.user))

      // Reload app
      setTimeout(() => window.location.reload(), 1500)
    }
  }
}

const handleResendCode = async () => {
  const result = await resendVerificationCode(pendingVerificationEmail!)
  return result
}
```

5. **Update login handler:**

```typescript
const handleLogin = async () => {
  const result = await signInWithEmail(email, password)

  if (result.success) {
    const syncResult = await syncUserWithBackend(
      result.user!,
      result.token!,
      false // isSignup
    )

    if (syncResult.success) {
      const expiryTime = result.expiresAt
        ? result.expiresAt * 1000
        : Date.now() + 60 * 60 * 1000

      localStorage.setItem('dbx_auth_token', result.token!)
      localStorage.setItem('dbx_refresh_token', result.refreshToken || '')
      localStorage.setItem('dbx_token_expiry', expiryTime.toString())
      localStorage.setItem('dbx_token_type', 'cognito')
      localStorage.setItem('dbx_user_info', JSON.stringify(syncResult.user))

      setTimeout(() => window.location.reload(), 1500)
    }
  } else {
    setErrorMessage(result.error || 'Login failed')
  }
}
```

6. **Update the render to show verification screen:**

```typescript
if (currentView === 'verification') {
  return (
    <VerificationCode
      email={pendingVerificationEmail!}
      onVerify={handleVerifyCode}
      onResend={handleResendCode}
      onBack={goBackToOptions}
      isDarkTheme={theme === 'dark'}
    />
  )
}
```

7. **Add signup form fields in the JSX:**

```tsx
{!isLogin && (
  <>
    <input
      type="text"
      placeholder="First Name *"
      value={firstName}
      onChange={(e) => setFirstName(e.target.value)}
      required
    />
    <input
      type="text"
      placeholder="Last Name *"
      value={lastName}
      onChange={(e) => setLastName(e.target.value)}
      required
    />
    <select
      value={genderId}
      onChange={(e) => setGenderId(e.target.value)}
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

### Step 5: Create .env.local Files

Create `.env.local` files in both apps with the actual configuration:

#### Web App: `apps/web/.env.local`

```bash
VITE_API_URL=http://localhost:3002
VITE_MAIN_SERVER_URL=http://localhost:8000
VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
```

#### Desktop App: `apps/desktop/.env.local`

```bash
VITE_API_URL=http://localhost:3001
VITE_MAIN_SERVER_URL=http://localhost:8000
VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
```

### Step 6: Backend Requirements

Your backend server (running on `localhost:8000`) needs to:

1. **Install JWT verification library:**

```bash
npm install aws-jwt-verify
```

2. **Create token verification middleware:**

```javascript
const { CognitoJwtVerifier } = require('aws-jwt-verify')

const verifier = CognitoJwtVerifier.create({
  userPoolId: 'us-east-1_jttIzc3Av',
  clientId: '58n2mqt76oqjpau29jbo07bnbl',
  tokenUse: 'id',
})

async function verifyCognitoToken(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const payload = await verifier.verify(token)

    req.user = {
      cognitoUserId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
    }

    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

3. **Add `cognito_user_id` column to users table:**

```sql
ALTER TABLE users ADD COLUMN cognito_user_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_cognito_user_id ON users(cognito_user_id);
```

4. **Update `/auth/signup` endpoint:**

```javascript
app.post('/api/v1/auth/signup', verifyCognitoToken, async (req, res) => {
  const { cognito_user_id, email, first_name, last_name, gender_id, profile_pic_url } = req.body

  // Check if user exists
  let user = await db.users.findOne({ where: { cognito_user_id } })

  if (!user) {
    user = await db.users.create({
      cognito_user_id,
      email,
      first_name,
      last_name,
      gender_id,
      profile_pic_url,
    })
  }

  res.json({ success: true, user })
})
```

5. **Update `/auth/login` endpoint:**

```javascript
app.post('/api/v1/auth/login', verifyCognitoToken, async (req, res) => {
  const { cognito_user_id, email } = req.body

  const user = await db.users.findOne({ where: { cognito_user_id } })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  await user.update({ last_login: new Date() })

  res.json({ success: true, user })
})
```

### Step 7: Testing

1. **Start the backend server on localhost:8000**

2. **Test signup flow:**
   - Fill in all fields (first name, last name, email, password)
   - Click "Sign Up"
   - Check email for 6-digit code
   - Enter code in verification screen
   - Verify auto-login after verification
   - Check localStorage for tokens
   - Verify user data in backend database

3. **Test login flow:**
   - Enter existing email and password
   - Click "Sign In"
   - Verify successful login
   - Check localStorage for tokens

4. **Test token refresh:**
   - Wait for token to expire or manually expire it
   - Make an API request
   - Verify token auto-refreshes via Amplify

---

## Summary of Files Created

### Web App
- ✅ `apps/web/src/shared/constants/serverConfig.ts`
- ✅ `apps/web/src/shared/config/amplifyConfig.ts`
- ✅ `apps/web/src/shared/utils/cognitoAuth.ts`
- ✅ `apps/web/src/shared/utils/cognitoTokenManager.ts`
- ⏳ `apps/web/src/features/auth/components/VerificationCode/index.tsx` (needs creation)
- ⏳ `apps/web/src/features/auth/components/VerificationCode/VerificationCode.css` (needs creation)

### Desktop App
- ✅ `apps/desktop/src/shared/constants/serverConfig.ts`
- ✅ `apps/desktop/src/shared/config/amplifyConfig.ts`
- ✅ `apps/desktop/src/shared/utils/cognitoAuth.ts`
- ✅ `apps/desktop/src/shared/utils/cognitoTokenManager.ts`
- ⏳ `apps/desktop/src/features/auth/components/VerificationCode/index.tsx` (needs creation)
- ⏳ `apps/desktop/src/features/auth/components/VerificationCode/VerificationCode.css` (needs creation)

### Modified Files
- ✅ `apps/web/src/shared/utils/authTokenManager.ts`
- ✅ `apps/web/src/shared/hooks/useConnections.ts`
- ✅ `apps/desktop/src/shared/utils/authTokenManager.ts`
- ✅ `apps/desktop/src/shared/hooks/useConnections.ts`
- ✅ `apps/web/.env.example`
- ✅ `apps/desktop/.env.example`
- ⏳ `apps/web/src/features/auth/components/Login/index.tsx` (needs update)
- ⏳ `apps/desktop/src/features/auth/components/Login/index.tsx` (needs update)

---

## Key Migration Points

1. **Username vs Email:**
   - Cognito requires username != email when email is used as an alias
   - We generate unique usernames: `user_1234567890_abc123`
   - Use username for `confirmSignUp`, but email for `signIn`

2. **Custom Attributes:**
   - `gender_id` and `profile_pic_url` are stored in your backend DB, not Cognito
   - Only `email`, `given_name`, `family_name` are sent to Cognito

3. **Token Management:**
   - Amplify automatically refreshes tokens - no manual refresh logic needed
   - Tokens stored in localStorage for backward compatibility
   - Token type set to `'cognito'` to distinguish from Firebase tokens

4. **Backend Synchronization:**
   - Two-stage authentication: Cognito first, then backend sync
   - Backend verifies Cognito JWT and manages app-specific data
   - Custom attributes managed entirely by your backend

---

## References

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [JWT Token Verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [Original Migration Guide](docs/amplify_migration.md)

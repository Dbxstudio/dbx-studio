# Authentication Fix Summary

## Issues Fixed

### 1. **oRPC Endpoint Format Issue** ✅
**Problem:** The frontend was calling `/api/rpc/auth/login` and `/api/rpc/auth/signup` but oRPC expects dot notation for method calls.

**Solution:** Changed the endpoints to use proper oRPC format:
- `/api/rpc/auth/login` → `/api/rpc/auth.login`
- `/api/rpc/auth/signup` → `/api/rpc/auth.signup`

**File Changed:** `apps/web/src/features/auth/components/Login/index.tsx`

### 2. **Missing Name Fields in Signup Form** ✅
**Problem:** When signing up, firstName and lastName fields were only shown for Cognito mode, but the local auth API also requires these fields.

**Solution:** Updated the signup form to show firstName and lastName fields for both Cognito and local auth modes. Only the gender field remains Cognito-specific.

**File Changed:** `apps/web/src/features/auth/components/Login/index.tsx`

### 3. **Google Sign-In Disabled** ✅
**Problem:** Google Sign-In was disabled because `useCognito` was hardcoded to `false`, even in web mode.

**Solution:** 
- Changed `useCognito` to automatically enable when `VITE_APP_MODE=web`
- Added missing environment variable types to TypeScript definitions
- Mounted REST auth routes for Firebase/Google authentication

**Files Changed:**
- `apps/web/src/features/auth/components/Login/index.tsx`
- `apps/web/src/vite-env.d.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/auth.ts` (already existed, just mounted)

### 4. **Missing REST Auth Routes** ✅
**Problem:** The backend had REST auth routes defined but they weren't mounted, so Firebase/Google authentication couldn't work.

**Solution:** Imported and mounted the REST auth routes at `/auth` endpoint.

**File Changed:** `apps/api/src/index.ts`

## How It Works Now

### Local Mode (`VITE_APP_MODE=internal` or not set)
- Uses local authentication (oRPC endpoints)
- Google Sign-In is disabled
- Users can sign up/login with email and password
- Data stored in memory (dev mode)

### Web Mode (`VITE_APP_MODE=web`)
- Uses Firebase/Google authentication
- Google Sign-In is **enabled**
- Users can:
  - Sign in with Google
  - Sign in with email/password (Firebase)
  - Sign up with email/password (Firebase)
- Requires Firebase backend verification via REST endpoints

## Testing

1. **Test Local Auth (Email/Password):**
   - Go to the login page
   - Click "Sign in with Email"
   - Enter email, password, first name, last name (for signup)
   - Submit the form
   - Expected: Should authenticate successfully

2. **Test Google Sign-In:**
   - Ensure `VITE_APP_MODE=web` in `.env`
   - Go to the login page
   - Click "Sign in with Google"
   - Expected: Google popup should appear and authenticate

## Environment Configuration

Your current `.env` file:
```env
VITE_APP_MODE=web  # Enables Firebase/Google authentication
VITE_API_URL=http://localhost:3002
VITE_MAIN_SERVER_URL=http://localhost:3002
```

This means:
- ✅ Google Sign-In is enabled
- ✅ Firebase authentication is enabled
- ✅ Local auth (oRPC) is also available as fallback

## Next Steps

1. Try signing up with email/password
2. Try signing in with the created account
3. Try Google Sign-In
4. Check the console for any remaining errors

All authentication methods should now work properly! 🎉

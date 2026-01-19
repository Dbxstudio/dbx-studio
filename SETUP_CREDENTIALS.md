# 🔐 Environment Variables Setup

## Quick Copy-Paste Template

Copy the following lines and paste them into your `.env.local` files:

```bash
# AWS Cognito Credentials
VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
VITE_MAIN_SERVER_URL=http://localhost:8000
```

---

## Setup Instructions

### Option 1: Quick Setup (Recommended)

1. **Copy the credentials above**

2. **For Web App:**
   ```bash
   # Add to apps/web/.env.local
   echo "VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
VITE_MAIN_SERVER_URL=http://localhost:8000" >> apps/web/.env.local
   ```

3. **For Desktop App:**
   ```bash
   # Add to apps/desktop/.env.local
   echo "VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
VITE_MAIN_SERVER_URL=http://localhost:8000" >> apps/desktop/.env.local
   ```

4. **Restart your dev server:**
   ```bash
   npm run dev
   ```

### Option 2: Manual Setup

1. Open `apps/web/.env.local` in your editor
2. Add the 4 credential lines from above
3. Save the file
4. Open `apps/desktop/.env.local` in your editor
5. Add the same 4 credential lines
6. Save the file
7. Restart your dev server

---

## Complete .env.local Template

### For Web App (`apps/web/.env.local`):

```bash
VITE_API_URL=http://localhost:3002
VITE_MAIN_SERVER_URL=http://localhost:8000
VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
```

### For Desktop App (`apps/desktop/.env.local`):

```bash
VITE_API_URL=http://localhost:3001
VITE_MAIN_SERVER_URL=http://localhost:8000
VITE_COGNITO_USER_POOL_ID=us-east-1_jttIzc3Av
VITE_COGNITO_CLIENT_ID=58n2mqt76oqjpau29jbo07bnbl
VITE_COGNITO_REGION=us-east-1
```

---

## Credential Details

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_COGNITO_USER_POOL_ID` | `us-east-1_jttIzc3Av` | AWS Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | `58n2mqt76oqjpau29jbo07bnbl` | AWS Cognito App Client ID |
| `VITE_COGNITO_REGION` | `us-east-1` | AWS Region |
| `VITE_MAIN_SERVER_URL` | `http://localhost:8000` | Backend Server URL |

---

## Verification

After setting up the credentials, verify they're loaded correctly:

1. Start the dev server: `npm run dev`
2. Open browser console
3. Check for Cognito configuration errors
4. If you see "⚠️ Cognito credentials missing!", check your `.env.local` files

---

## Security Notes

⚠️ **IMPORTANT:**
- `.env.local` files are **NOT** committed to git (already in `.gitignore`)
- These credentials are for **development only**
- Never commit real credentials to version control
- For production, use environment variables in your deployment platform

---

## Troubleshooting

### Error: "Cognito credentials missing"
- Check that `.env.local` files exist in both `apps/web/` and `apps/desktop/`
- Verify the variable names are exactly as shown (including `VITE_` prefix)
- Restart your dev server after making changes

### Changes not taking effect
- Stop your dev server (`Ctrl+C`)
- Clear Vite cache: `rm -rf apps/web/node_modules/.vite apps/desktop/node_modules/.vite`
- Restart: `npm run dev`

---

## Files Created/Modified

- ✅ `ENV_CREDENTIALS.txt` - Simple credential list
- ✅ `SETUP_CREDENTIALS.md` - This file (detailed setup guide)
- ✅ `apps/web/.env.local` - Already configured with credentials
- ✅ `apps/desktop/.env.local` - Already configured with credentials
- ✅ `apps/web/.env.example` - Template without real credentials
- ✅ `apps/desktop/.env.example` - Template without real credentials
- ✅ `apps/web/src/shared/config/amplifyConfig.ts` - No hardcoded values
- ✅ `apps/desktop/src/shared/config/amplifyConfig.ts` - No hardcoded values

---

**Your `.env.local` files are already configured!** ✨

Just restart your dev server and you're good to go!

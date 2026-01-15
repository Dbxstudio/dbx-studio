# Conar.app - Complete Architecture Documentation

> **AI-powered open-source database management tool** that simplifies database interactions with secure cloud-based connection storage and AI-assisted SQL query writing and optimization.

## Table of Contents

- [Project Overview](#project-overview)
- [Monorepo Structure](#monorepo-structure)
- [Frontend Tech Stack](#frontend-tech-stack)
- [Backend Tech Stack](#backend-tech-stack)
- [Database & Data Layer](#database--data-layer)
- [Authentication & Authorization](#authentication--authorization)
- [Desktop/Electron Architecture](#desktopelectron-architecture)
- [Development & Build Tools](#development--build-tools)
- [Key Dependencies](#key-dependencies)
- [Architecture Patterns](#architecture-patterns)
- [Data Flow](#data-flow)
- [Deployment](#deployment)

---

## Project Overview

**Conar.app** is a comprehensive database management solution supporting:
- **PostgreSQL**, **MySQL**, **MSSQL**, and **ClickHouse**
- AI-powered SQL query generation and optimization
- Secure encrypted connection storage
- Cross-platform desktop application (Electron)
- Web-based marketing and account management
- Offline-first architecture with cloud sync

---

## Monorepo Structure

Built as a **PNPM workspace** with **Turborepo** orchestration.

```
conar/
├── apps/
│   ├── api/          # Backend API (Hono + oRPC + Bun)
│   ├── desktop/      # Electron desktop app (React + PGlite)
│   └── web/          # Marketing site (TanStack Start SSR)
├── packages/
│   ├── ui/           # Shared UI components (Radix + Tailwind)
│   ├── shared/       # Shared utilities and types
│   ├── connection/   # Database connection utilities
│   └── configs/      # Shared TypeScript configurations
└── scripts/          # Build and setup automation
```

### Applications

#### 1. **apps/api** - Backend API Server
- **Runtime:** Bun (Node.js compatible)
- **Framework:** Hono 4.11.1
- **API Layer:** oRPC (type-safe RPC)
- **Database:** PostgreSQL 16 + Redis 7.2
- **Purpose:** Authentication, database connections, AI operations, data sync

#### 2. **apps/desktop** - Electron Desktop App
- **Framework:** Electron 39.2.6
- **Frontend:** React 19.2.3 + Vite 7.3.0
- **Local Database:** PGlite (embedded PostgreSQL)
- **Distribution:** ToDesktop
- **Purpose:** Cross-platform desktop client with offline-first architecture

#### 3. **apps/web** - Marketing Website
- **Framework:** TanStack Start (SSR)
- **Purpose:** Landing page, authentication, account management

### Packages

| Package | Purpose |
|---------|---------|
| `packages/ui` | Radix UI-based component library with shadcn/ui patterns |
| `packages/shared` | Constants, enums, utilities, Arktype schemas |
| `packages/connection` | Database connection string parsing, SSL configuration |
| `packages/configs` | Shared TypeScript configurations |

---

## Frontend Tech Stack

### Core Framework & Build

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.9.3 | Type safety |
| **Vite** | 7.3.0 | Build tool and dev server |
| **Electron** | 39.2.6 | Desktop wrapper |
| **Bun** | Latest | Package management and runtime |

### UI Components & Styling

| Technology | Purpose |
|------------|---------|
| **Radix UI** | Headless UI primitives (Dialog, Dropdown, Tabs, Accordion, etc.) |
| **Tailwind CSS** | 4.1.18 - Utility-first styling |
| **shadcn/ui** | Component architecture patterns |
| **class-variance-authority** | Component variant management |
| **tailwind-merge** | Class merging utility |
| **tw-animate-css** | Animation utilities |
| **tailwind-scrollbar** | Custom scrollbar styling |
| **lucide-react** | Primary icon library |
| **@remixicon/react** | Additional icons |
| **Sonner** | Toast notifications |
| **Motion** | Animations (Framer Motion) |

### State Management

| Technology | Purpose |
|------------|---------|
| **@tanstack/react-store** | Local state management |
| **@tanstack/react-db** | Local database state with sync |
| **tanstack-db-pglite** | PGlite adapter for TanStack DB |
| **localStorage** | Persistent settings and database state |

### Routing

| Technology | Purpose |
|------------|---------|
| **@tanstack/react-router** | 1.143.4 - Type-safe routing |
| **@tanstack/router-plugin** | Vite plugin for route generation |
| **TanStack Start** | 1.143.4 - SSR framework (web app) |

### Forms & Validation

| Technology | Purpose |
|------------|---------|
| **@tanstack/react-form** | 1.27.6 - Type-safe form management |
| **Arktype** | 2.1.29 - Runtime type validation |
| **Zod** | 4.2.1 - Schema validation |
| **input-otp** | OTP input component |

### Data Fetching

| Technology | Purpose |
|------------|---------|
| **@tanstack/react-query** | 5.90.12 - Server state management |
| **@orpc/client** | oRPC client for type-safe API calls |
| **@orpc/tanstack-query** | TanStack Query integration for oRPC |
| **Superjson** | JSON serialization with extended types |

### AI Integration

| Technology | Purpose |
|------------|---------|
| **@ai-sdk/react** | Vercel AI SDK React hooks |
| **ai** | Core AI SDK functionality |
| **react-markdown** | Markdown rendering for AI responses |
| **remark-gfm** | GitHub Flavored Markdown |
| **marked** | Additional markdown parsing |

### Code Editor

| Technology | Purpose |
|------------|---------|
| **Monaco Editor** | SQL code editor with syntax highlighting |
| **monaco-sql-languages** | SQL language support |
| **sql-formatter** | SQL query formatting |

### Data Visualization

| Technology | Purpose |
|------------|---------|
| **@xyflow/react** | Flow diagrams and visual database schema |
| **@dagrejs/dagre** | Graph layout algorithm |
| **@tanstack/react-virtual** | 3.13.13 - Virtual scrolling for large lists |

### Additional Libraries

| Technology | Purpose |
|------------|---------|
| **react-resizable-panels** | Resizable layout panels |
| **cmdk** | Command palette |
| **dayjs** | Date manipulation |
| **@number-flow/react** | Animated number transitions |
| **use-stick-to-bottom** | Auto-scroll behavior |
| **uuid** / **nanoid** | Unique ID generation |

### Development Tools

| Technology | Purpose |
|------------|---------|
| **@tanstack/react-devtools** | React debugging |
| **@tanstack/react-query-devtools** | Query debugging |
| **react-scan** | Render performance monitoring (dev) |
| **react-grab** | Visual element inspector (dev) |

---

## Backend Tech Stack

### Runtime & Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Bun** | Latest | JavaScript runtime (preferred) |
| **Node.js** | Compatible | Fallback runtime |
| **Hono** | 4.11.1 | Lightweight web framework |

### API Architecture

**oRPC** - Type-safe RPC framework

| Package | Purpose |
|---------|---------|
| **@orpc/server** | 1.13.0 - Server-side RPC |
| **@orpc/contract** | Shared API contracts |
| **@hono/arktype-validator** | Request validation |

### Middleware

- **cors** - CORS handling
- **logger** - Request logging

### API Router Structure

```
apps/api/src/orpc/routers/
├── ai/                    # AI chat, SQL generation, prompt enhancement, web search
├── databases/             # Database CRUD operations, sync
├── queries/               # Saved queries management
├── chats/                 # Chat sessions management
├── chats-messages/        # Chat message history
├── banner/                # App-wide banner messages
└── contact/               # Contact form
```

---

## Database & Data Layer

### Database Technologies

| Database | Purpose |
|----------|---------|
| **PostgreSQL 16** | Primary production database (API) |
| **PGlite** | Embedded PostgreSQL (desktop local storage) |
| **Redis 7.2** | Caching and session storage |

### Database Clients

| Client | Purpose |
|--------|---------|
| **postgres.js** | PostgreSQL client (API) |
| **ioredis** | Redis client |
| **ioredis-mock** | Redis mocking for tests |
| **@electric-sql/pglite** | Embedded PostgreSQL for desktop |

### User Database Drivers

| Driver | Database |
|--------|----------|
| **pg** | PostgreSQL connections |
| **mysql2** | MySQL connections |
| **mssql** | Microsoft SQL Server |
| **@clickhouse/client** | ClickHouse |

### ORM & Query Builder

| Technology | Purpose |
|------------|---------|
| **Drizzle ORM** | 0.45.1 - TypeScript ORM |
| **drizzle-kit** | 0.31.8 - Schema migration tool |
| **drizzle-arktype** | Arktype integration for schema validation |

### Migration Strategy

**Production (API):**
- Drizzle Kit migrations with `drizzle-kit migrate`
- Migrations stored in `src/drizzle/migrations/`
- Applied automatically on server start

**Desktop:**
- Custom migration runner
- Reads compiled `migrations.json`
- Applied on app startup

**Database Naming:**
- **snake_case** for all database columns
- **camelCase** in TypeScript code
- Automatic conversion via Drizzle

### Database Schema

#### API Database (PostgreSQL)

**Authentication & Users:**

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, 2FA, Stripe integration) |
| `sessions` | User sessions with bearer token support |
| `accounts` | OAuth provider accounts |
| `verifications` | Email verification tokens |
| `two_factors` | 2FA secrets and backup codes |
| `workspaces` | Team/organization workspaces |
| `members` | Workspace membership |
| `invitations` | Workspace invitations |
| `subscriptions` | Stripe subscription details |

**Application Data:**

| Table | Purpose | Encryption |
|-------|---------|------------|
| `databases` | User database connections | ✅ Connection strings encrypted |
| `queries` | Saved SQL queries | ✅ Query content encrypted |
| `chats` | AI chat sessions | - |
| `chats_messages` | Chat message history | ✅ Messages encrypted |

**Encryption Details:**
- Custom `encryptedText()` and `encryptedJson()` Drizzle column types
- Symmetric encryption with user-specific secrets
- Data encrypted at rest before storage

#### Desktop Database (PGlite/IndexedDB)

**Synced Tables:**
- `databases` - Synced from API
- `queries` - Synced from API
- `chats` - Synced from API
- `chats_messages` - Synced from API

**No Authentication Tables:**
- Desktop uses API for authentication
- Bearer tokens stored in Electron Store

### Row Level Security (RLS)

- API database schemas use `.enableRLS()` on tables
- Ensures data isolation per user
- Prevents unauthorized access

---

## Authentication & Authorization

### Auth Strategy

| Method | Supported |
|--------|-----------|
| **Email/Password** | ✅ |
| **OAuth 2.0 / OIDC** | ✅ (Google, GitHub) |
| **2FA (TOTP)** | ✅ |
| **Anonymous Auth** | ✅ (Guest access) |
| **Bearer Token** | ✅ (Desktop app) |

### Auth Library

**Better Auth** 1.4.9 - Modern authentication library

#### Plugins Used:

| Plugin | Purpose |
|--------|---------|
| `bearer()` | Token-based authentication for desktop |
| `twoFactor()` | TOTP 2FA support |
| `organization()` | Workspace/team support |
| `lastLoginMethod()` | Track login method |
| `emailHarmony()` | Email authentication (`better-auth-harmony`) |
| `anonymous()` | Guest authentication |
| `stripe()` | Subscription management (`@better-auth/stripe`) |

#### Custom Plugins:

- **`noSetCookiePlugin()`** - Prevents cookie setting for desktop app

### Social Providers

- **Google OAuth** - Configured in environment
- **GitHub OAuth** - Configured in environment

### Session Management

| Platform | Storage |
|----------|---------|
| **API** | PostgreSQL sessions table |
| **Desktop** | Bearer tokens in Electron Store |
| **Web** | HTTP-only cookies |

### Password Reset

- Email-based reset flow
- **Resend** for email delivery
- **React Email** templates

### Authorization Patterns

1. **Middleware-based auth** - `authMiddleware` in oRPC
2. **Session validation** - On each request
3. **User-specific isolation** - Via RLS
4. **Workspace-based access** - Organization plugin

---

## Desktop/Electron Architecture

### Electron Setup

| Technology | Purpose |
|------------|---------|
| **Electron** | 39.2.6 - Desktop framework |
| **electron-vite** | Build configuration |
| **electron-builder** | Packaging |
| **@todesktop/cli** | ToDesktop deployment |
| **@todesktop/runtime** | Auto-updates |
| **electron-store** | Persistent settings |

### Process Structure

```
apps/desktop/
├── electron/
│   ├── main/          # Main process
│   │   └── index.ts   # Window management, IPC handlers
│   └── preload/       # Preload script
│       └── index.ts   # contextBridge API exposure
└── src/
    └── main.tsx       # Renderer process (React app)
```

### IPC Communication

**Exposed via `contextBridge` in preload:**

#### Query Handlers

```typescript
electron.query.postgres(connectionString, query, params)
electron.query.mysql(connectionString, query, params)
electron.query.mssql(connectionString, query, params)
electron.query.clickhouse(connectionString, query, params)
```

#### Encryption

```typescript
electron.encryption.encrypt(data)
electron.encryption.decrypt(data)
```

#### App Functions

```typescript
electron.app.checkForUpdates()
electron.app.quitAndInstall()
electron.app.onDeepLink(callback)
electron.app.onUpdatesStatus(callback)
electron.app.onNavigate(callback)
electron.app.onSendToast(callback)
```

#### Version Info

```typescript
electron.versions.node()
electron.versions.chrome()
electron.versions.electron()
electron.versions.app()
```

### Desktop-Specific Features

1. **Direct Database Connections**
   - Bypasses API for query execution
   - Connection pooling with memoization
   - Auto-reconnection (max 5 retries)
   - Full SSL/TLS support

2. **Offline-First Architecture**
   - Local PGlite database
   - Background sync with server
   - Optimistic updates
   - Works fully offline

3. **Auto-Updates**
   - ToDesktop-powered updates
   - Automatic download and install
   - Update status notifications

4. **Deep Linking**
   - Custom protocol handler
   - OAuth callback handling

5. **Window Management**
   - State persistence (size, position)
   - Custom application menus
   - Multi-window support

6. **System Integration**
   - System-level notifications
   - Toast messages
   - Tray icon (if configured)

### Connection Pool Memoization

```typescript
// Cached connection pools by connection string
const postgresPool = memoizedPostgresConnection(connectionString)
const mysqlPool = memoizedMysqlConnection(connectionString)
// ... etc
```

### Error Handling

- Connection error detection
- Automatic retry logic
- User-friendly error transformation
- Toast notifications for failures

---

## Development & Build Tools

### Package Manager

**pnpm** 10.26.2 - Fast, disk-efficient package manager

Features:
- Workspace catalog mode
- Centralized dependency versions in `pnpm-workspace.yaml`
- Phantom dependencies prevention

### Monorepo Tools

| Tool | Purpose |
|------|---------|
| **Turbo** | 2.7.2 - Build orchestration and caching |
| **turbo.json** | Pipeline configuration |
| **npm-run-all2** | Parallel script execution |

### TypeScript Configuration

**TypeScript** 5.9.3 with:
- **Strict mode** enabled
- **Composite projects** for faster builds
- **Path mapping** - `~/` alias for src directories
- **TSX** for TypeScript execution

### Linting & Formatting

| Tool | Purpose |
|------|---------|
| **ESLint** | 9.39.2 - Linting |
| **@antfu/eslint-config** | Opinionated config |
| **@eslint-react/eslint-plugin** | React rules |
| **eslint-plugin-react-hooks** | Hooks rules |
| **eslint-plugin-react-refresh** | Fast Refresh rules |
| **eslint-plugin-better-tailwindcss** | Tailwind class ordering |

**Key Rules:**
- `ts/no-explicit-any: error` - Prevent explicit any
- `no-console: warn` - Warn on console usage
- Custom hooks: `useMountedEffect`, `useAsyncEffect`

### Testing

| Tool | Purpose |
|------|---------|
| **Playwright** | 1.57.0 - E2E testing |
| **Bun Test** | Unit testing (built-in) |
| **@faker-js/faker** | Test data generation |
| **PGlite** | In-memory test database |

### Git Hooks

| Tool | Purpose |
|------|---------|
| **Husky** | 9.1.7 - Git hooks |
| **@commitlint/cli** | Commit message linting |
| **@commitlint/config-conventional** | Conventional commits |

### Build Optimization

- **React Compiler** (`babel-plugin-react-compiler`) - Automatic optimization
- **Vite plugins:**
  - `@vitejs/plugin-react` - Fast Refresh
  - `vite-tsconfig-paths` - Path mapping
  - `@tanstack/router-plugin` - Route generation

---

## Key Dependencies

### AI & LLM Integration

| Package | Purpose |
|---------|---------|
| **ai** | 5.0.116 - Vercel AI SDK |
| **@ai-sdk/anthropic** | Claude models |
| **@ai-sdk/openai** | GPT models |
| **@ai-sdk/google** | Gemini models |
| **@ai-sdk/xai** | Grok models |
| **@exalabs/ai** | Web search tool for AI |
| **ai-retry** | Retry logic for AI calls |
| **@posthog/ai** | AI analytics |

### Payment & Subscription

| Package | Purpose |
|---------|---------|
| **Stripe** | 20.1.0 - Payment processing |
| **@better-auth/stripe** | Auth-Stripe integration |

### Email & Communication

| Package | Purpose |
|---------|---------|
| **Resend** | 6.6.0 - Email delivery |
| **@react-email/components** | Email templates |
| **Loops** | 6.0.1 - Email marketing |

### Analytics & Monitoring

| Package | Purpose |
|---------|---------|
| **posthog-node** | Server-side analytics |
| **posthog-js** | Client-side analytics |
| **consola** | Enhanced logging |

### Data Validation

| Package | Purpose |
|---------|---------|
| **Arktype** | 2.1.29 - Runtime validation |
| **Zod** | 4.2.1 - Schema validation |
| **arkregex** | Regex utilities |
| **drizzle-arktype** | Drizzle-Arktype integration |

### Utilities

| Package | Purpose |
|---------|---------|
| **date-fns** / **dayjs** | Date manipulation |
| **nanoid** / **uuid** | Unique IDs |
| **js-base64** | Base64 encoding |
| **clsx** | Conditional classes |
| **ua-parser-js** | User agent parsing |

### GitHub Integration

| Package | Purpose |
|---------|---------|
| **@octokit/rest** | GitHub API client |
| **@databuddy/sdk** | DataBuddy integration |

---

## Architecture Patterns

### 1. Type-Safe RPC (oRPC)

**Contract-based API:**

```typescript
// Server defines router
export const router = orpc.router({
  getDatabases: orpc
    .input(schema({ userId: string() }))
    .output(schema({ databases: array(Database) }))
    .handler(async ({ input }) => {
      // Implementation
    })
})

// Client automatically infers types
const { databases } = await client.getDatabases({ userId: '123' })
//     ^? Type: Database[]
```

**Benefits:**
- Full type safety from server to client
- Automatic validation with Arktype
- No code generation needed
- Contract-first development

### 2. Offline-First Architecture (Desktop)

**TanStack DB Collections:**

```typescript
const databasesCollection = createCollection(drizzleCollectionOptions({
  db: pglite,
  table: databasesTable,
  sync: async ({ collection, write }) => {
    // 1. Fetch from server
    const serverData = await orpc.databases.list()

    // 2. Compare with local state
    const toCreate = /* ... */
    const toUpdate = /* ... */
    const toDelete = /* ... */

    // 3. Apply changes locally
    await write(async (tx) => {
      // Update local database
    })
  }
}))
```

**Benefits:**
- Works offline
- Optimistic updates
- Background sync
- Conflict resolution

### 3. Encryption at Rest

**Custom Drizzle Column Types:**

```typescript
// Schema definition
export const databasesTable = pgTable('databases', {
  id: uuid('id').primaryKey(),
  connectionString: encryptedText('connection_string'), // Encrypted
  name: text('name'),
})

// Automatic encryption/decryption
const db = await insert(databasesTable).values({
  connectionString: 'postgresql://...' // Encrypted before storage
})
```

**Encryption Methods:**
- AES-256-GCM symmetric encryption
- User-specific encryption keys
- Transparent encryption/decryption

### 4. Memoized Connection Pools

**Connection Pool Caching:**

```typescript
const pools = new Map<string, Pool>()

export function getPostgresPool(connectionString: string) {
  if (!pools.has(connectionString)) {
    pools.set(connectionString, createPool(connectionString))
  }
  return pools.get(connectionString)!
}
```

**Benefits:**
- Reuses existing connections
- Prevents connection leaks
- Automatic reconnection

### 5. Entity-Based Organization

**Entity Pattern:**

```
entities/database/
├── store.ts              # TanStack Store state
├── sync.ts               # TanStack DB collection
├── index.ts              # Public API
├── queries/              # Data fetching
├── sql/                  # SQL generation
└── components/           # UI components
```

**Example Entity:**

```typescript
// store.ts - Local state
export const databaseStore = new Store({
  currentDatabaseId: null,
  filterText: '',
})

// sync.ts - Server sync
export const databasesCollection = createCollection({ /* ... */ })

// queries/ - Data fetching
export function getDatabaseById(id: string) {
  return databasesCollection.select((db) => db.id === id)
}

// components/ - UI
export function DatabaseList() {
  const databases = useStore(databasesCollection.state)
  // ...
}
```

**Benefits:**
- Clear domain boundaries
- Reusable logic
- Isolated testing
- Easy to navigate

### 6. Tool-Augmented AI

**AI SDK Tools:**

```typescript
const tools = {
  columns: tool({
    description: 'Get columns for a table',
    parameters: z.object({ table: z.string() }),
    execute: async ({ table }) => {
      // Fetch actual columns from database
      return columns
    }
  }),
  select: tool({
    description: 'Query database',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      // Execute query on actual database
      return results
    }
  })
}
```

**Benefits:**
- Grounds AI in actual data
- Prevents hallucination
- Real-time schema introspection
- Accurate query generation

### 7. Compound Components (UI)

**Radix UI Pattern:**

```typescript
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Benefits:**
- Composable API
- Flexible customization
- Accessible by default

### 8. Store-Based State Management

**TanStack Store:**

```typescript
const settingsStore = new Store({
  theme: 'dark',
  fontSize: 14,
})

// Persist to localStorage
settingsStore.subscribe((state) => {
  localStorage.setItem('settings', JSON.stringify(state))
})

// Use in components
function Settings() {
  const theme = useStore(settingsStore, (s) => s.theme)
  // ...
}
```

**Benefits:**
- Simple API
- TypeScript support
- Reactive updates
- Easy persistence

---

## Data Flow

### Desktop App Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     User Interaction                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   React Components                       │
│              (TanStack Form, Store hooks)                │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌───────────────────────┐   ┌───────────────────────────┐
│   TanStack Store      │   │   TanStack DB Collection  │
│   (UI State)          │   │   (Data State)            │
└───────────────────────┘   └───────────────────────────┘
              │                           │
              │                           ▼
              │             ┌───────────────────────────┐
              │             │   PGlite (IndexedDB)      │
              │             │   (Local Database)        │
              │             └───────────────────────────┘
              │                           │
              │                           ▼
              │             ┌───────────────────────────┐
              │             │   Background Sync         │
              │             └───────────────────────────┘
              │                           │
              │                           ▼
              │             ┌───────────────────────────┐
              └────────────▶│   oRPC Client             │
                            │   (Type-safe API calls)   │
                            └───────────────────────────┘
                                          │
                                          ▼
                            ┌───────────────────────────┐
                            │   Backend API             │
                            │   (Hono + oRPC Server)    │
                            └───────────────────────────┘
                                          │
                                          ▼
                            ┌───────────────────────────┐
                            │   PostgreSQL + Redis      │
                            │   (Production Database)   │
                            └───────────────────────────┘
```

### Direct Database Query Flow (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│              User executes SQL query                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│             React Component (Query Editor)               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         electron.query.postgres() (IPC call)             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Electron Main Process                       │
│         (Memoized Connection Pool)                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│          Direct Database Connection                      │
│     (PostgreSQL/MySQL/MSSQL/ClickHouse)                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Results returned to UI                      │
└─────────────────────────────────────────────────────────┘
```

### AI Chat Flow

```
┌─────────────────────────────────────────────────────────┐
│           User sends message to AI                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│          Chat Component (useChat hook)                   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         oRPC call to ai.chat endpoint                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API Server                          │
│      (AI SDK with tool augmentation)                     │
└─────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────┐   ┌───────────────────────────┐
│   LLM API Call        │   │   Tool Execution          │
│  (Claude/GPT/Gemini)  │   │  (columns, select, etc.)  │
└───────────────────────┘   └───────────────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│          Streaming response to client                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│       Save encrypted message to database                 │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment

### Production Hosting

| Component | Platform |
|-----------|----------|
| **API** | Railway |
| **Database** | Supabase (PostgreSQL) |
| **Redis** | Railway / Upstash |
| **Web** | Nitro SSR deployment |
| **Desktop** | ToDesktop distribution |

### Environment Variables

**Required for API:**
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
RESEND_API_KEY=...
```

**Required for Desktop:**
```env
VITE_API_URL=https://api.conar.app
```

### Build Commands

**API:**
```bash
pnpm install
pnpm run build:api
bun run start
```

**Desktop:**
```bash
pnpm install
pnpm run build:desktop
pnpm run package  # Create distributable
```

**Web:**
```bash
pnpm install
pnpm run build:web
```

### CI/CD

- **GitHub Actions** for automated builds
- **Turbo Remote Cache** for faster builds
- **pnpm** version locked in CI (10.26.2)

### Desktop Distribution

**ToDesktop:**
- Automatic updates
- Cross-platform builds (Windows, macOS, Linux)
- Code signing
- Auto-updater integration

---

## Summary

**Conar.app** is a modern, type-safe, offline-first database management tool built with:

- **Frontend:** React 19 + Vite + TanStack ecosystem
- **Backend:** Bun + Hono + oRPC
- **Database:** PostgreSQL + Drizzle ORM + PGlite
- **Auth:** Better Auth with OAuth, 2FA, workspaces
- **AI:** Vercel AI SDK with tool augmentation
- **Desktop:** Electron + ToDesktop
- **Monorepo:** pnpm + Turborepo
- **Styling:** Tailwind CSS 4 + Radix UI

**Key Features:**
- Type-safe full-stack development
- Offline-first with cloud sync
- End-to-end encryption
- AI-powered SQL generation
- Multi-database support (PostgreSQL, MySQL, MSSQL, ClickHouse)
- Cross-platform desktop app
- Modern React patterns (Server Components, Suspense, Concurrent Rendering)

---

**Last Updated:** 2026-01-08
**Version:** Current main branch (d6fa86f8)
# DBX Studio

AI-powered open-source database management tool that simplifies database interactions with secure connection storage and AI-assisted SQL query writing.

## Features

- **Multi-Database Support**: PostgreSQL, MySQL, SQLite, MSSQL, Snowflake (coming soon)
- **AI-Powered SQL**: Generate and optimize queries using natural language with Claude, OpenAI, or AWS Bedrock
- **Cross-Platform**: Desktop app (Electron) and Web app
- **Query History**: Track and manage your SQL queries
- **Workspace Management**: Organize connections and queries

## Project Structure

```
dbx-studio/
├── apps/
│   ├── api/          # Backend API (Hono + Bun)
│   ├── web/          # Web application (React + Vite)
│   └── desktop/      # Desktop app (Electron + React)
├── packages/
│   ├── ui/           # Shared UI components
│   └── shared/       # Shared utilities and types
└── docs/             # Documentation
```

## Tech Stack

### Frontend
- React 18
- Vite
- Electron (desktop)
- TailwindCSS
- TanStack Query & Router
- Monaco Editor

### Backend
- Bun (runtime)
- Hono (web framework)
- Drizzle ORM
- PGLite (embedded database)
- oRPC (type-safe RPC)

## Prerequisites

- Node.js >= 18
- Bun >= 1.0
- pnpm >= 8

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

**Backend (apps/api):**

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` and add your AI provider credentials:

```env
# Server
PORT=3002

# AI Provider (choose one)
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENAI_API_KEY=sk-...
# OR
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Web App (apps/web):**

```bash
cd apps/web
cp .env.example .env
```

**Desktop App (apps/desktop):**

```bash
cd apps/desktop
cp .env.example .env
```

### 3. Start Development

**Option A: Start All Apps**

```bash
pnpm dev
```

**Option B: Start Individual Apps**

```bash
# Terminal 1 - Backend API
cd apps/api
bun run dev
# Server runs at http://localhost:3002

# Terminal 2 - Web App
cd apps/web
pnpm dev
# Opens at http://localhost:5174

# Terminal 3 - Desktop App (optional)
cd apps/desktop
pnpm dev
# Electron window opens
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:api` | Start only the API server |
| `pnpm dev:desktop` | Start only the desktop app |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Lint all packages |
| `pnpm clean` | Clean all build artifacts |
| `pnpm format` | Format code with Prettier |

### API Scripts (apps/api)

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `drizzle-kit studio` | Open database GUI |
| `drizzle-kit generate` | Generate migrations |
| `drizzle-kit migrate` | Run migrations |

### Web/Desktop Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |

## Database

The API uses PGLite (SQLite-compatible) for storing:
- Database connections
- Query history
- AI chat sessions
- Application settings

**No external database setup required** - the database is automatically initialized on first run.

## AI Providers

DBX Studio supports multiple AI providers:

| Provider | Models | Configuration |
|----------|--------|---------------|
| AWS Bedrock | Claude 3.5 Haiku/Sonnet | AWS credentials |
| Anthropic | Claude 3.5 | API key |
| OpenAI | GPT-4, GPT-3.5 | API key |

Configure your preferred provider in the `.env` file or through the app settings.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Desktop App   │     │     Web App     │
│   (Electron)    │     │    (Browser)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   Backend   │
              │  (Hono/Bun) │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │ PGLite  │ │   AI    │ │  User   │
    │ (Local) │ │Providers│ │   DBs   │
    └─────────┘ └─────────┘ └─────────┘
```

## Development

### Running Tests

```bash
pnpm test
```

### Code Formatting

```bash
pnpm format
```

### Linting

```bash
pnpm lint
```

## Deployment

### Web App (Vercel)

The web app can be deployed to Vercel:

```bash
cd apps/web
vercel
```

### API (Railway/Render)

The API can be deployed to Railway, Render, or any platform supporting Bun:

```bash
cd apps/api
# Build
bun build src/index.ts --outdir ./dist --target bun
# Run
bun run dist/index.js
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Apache 2.0 - see [LICENSE](LICENSE) file for details.

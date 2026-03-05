<div align="center">

<img src="apps/desktop/public/assets/dbx-logo-new.png" alt="DBX Studio Logo" width="200"/>



[![Discord](https://img.shields.io/badge/DISCORD-JOIN%20COMMUNITY-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/invite/jSU9dAqf)

</div>

# DBX Studio
AI-powered open-source database management tool that simplifies database interactions with secure connection storage and AI-assisted SQL query writing.

---

## ✨ Try DBX Studio

[![Download DBX Studio](apps/web/public/assets/Whisk_bbc181a05014fcc973741ec56f489558dr%201.png)](https://www.dbxstudio.com/download)


---

## ✨ Features

### 🧠 Intelligent Query Generation
Describe what you want in plain English — DBX generates optimized SQL queries instantly.

![AI SQL Chat](apps/web/public/assets/AI%20SQL%20Chat.png)

### 📊 Schema-Aware Workspace
Understands your tables, relationships, and columns to generate accurate queries.

![BI Analytics](apps/web/public/assets/BI%20Analytics.png)

### 🔍 Smart Data Exploration
Browse tables, preview rows, filter results, and inspect relationships visually.

![Table Operations](apps/web/public/assets/Table%20Operations.png)

### 🛠️ Full SQL Editor

- Syntax highlighting
- Autocomplete
- Query history
- Multi-tab workspace

### 🔌 Multi-Database Support

**Supports:**

- PostgreSQL
- Snowflake
- SQLite
- Supabase
- Amazon Redshift
- MySQL
- MSSQL
- *More coming soon*

### 🔒 Secure by Design

- Local-first architecture
- Secure credential handling
- No data stored without your permission

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

## Docker Image (Windows)
```bash
docker run -d --name dbx-studio1 -p 3000:3000 -p 3002:3002 -v "${PWD}\app_data:/app/data" -v "${PWD}\api_data:/app/apps/api/data" dbx25/dbx-studio1:latest
```
## Docker Image (Mac/Linux)
```bash
docker run -d --name dbx-studio1 -p 3000:3000 -p 3002:3002 -v "$(pwd)/app_data:/app/data" -v "$(pwd)/api_data:/app/apps/api/data" dbx25/dbx-studio1:latest
```

## Electron App

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


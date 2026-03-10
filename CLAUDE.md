# DBX Studio — Claude Code Context

## Project Overview
DBX Studio is a full-stack database IDE monorepo. Users connect to databases and chat with an AI assistant to query and visualize data.

## Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: React + Vite (`apps/web`)
- **Backend API**: Hono + oRPC + Drizzle ORM (`apps/api`)
- **Desktop**: Electron (`apps/desktop`)
- **Shared packages**: `packages/shared`, `packages/ui`
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: Multi-provider (AWS Bedrock, OpenAI, Anthropic, Ollama, Gemini, Groq)

## Key Directories

```
apps/
  api/src/
    routes/         ← Hono HTTP routes (ai-stream.ts, auth.ts, health.ts)
    orpc/routers/   ← oRPC procedure routers
      ai/           ← AI chat, tools, providers, tool executor
      connections/  ← DB connection CRUD
      queries/      ← Query history
      tables/       ← Schema table management
  web/src/features/ ← React feature modules (ai, connections, editor, datagrid, schema)
api/index.ts        ← Vercel serverless entry point
```

## AI System Architecture

The AI chat system has two paths:
1. **SSE Streaming** (`/api/ai/query-stream`) — main path, uses AWS Bedrock by default
2. **oRPC chat** (`/api/rpc/ai/*`) — structured sessions with memory

AI tools are defined in [apps/api/src/orpc/routers/ai/tools.ts](apps/api/src/orpc/routers/ai/tools.ts):
- `read_schema`, `get_table_data`, `execute_query`, `generate_chart`, `describe_table`, `get_table_stats`

System prompts live in:
- [apps/api/src/routes/ai-stream.ts](apps/api/src/routes/ai-stream.ts) — streaming prompt (inline, ~line 132)
- [apps/api/src/orpc/routers/ai/providersWithTools.ts](apps/api/src/orpc/routers/ai/providersWithTools.ts) — `SYSTEM_PROMPT_WITH_TOOLS`

## Skills Available

This project has custom skills in `.claude/skills/`:

| Skill | When Claude Uses It |
|-------|---------------------|
| `sql-queries` | Writing, optimizing, or debugging SQL queries |
| `data-exploration` | Profiling schemas, understanding data structure |
| `data-visualization` | Creating charts with `generate_chart` tool |
| `ai-tools` | Adding/editing AI tools or tool executor logic |
| `system-prompt` | Editing the AI system prompt behavior |

## Development Commands

```bash
pnpm dev          # Start all apps
pnpm build        # Build all apps
pnpm --filter api dev   # API only
pnpm --filter web dev   # Web only
```

## Conventions
- Use Drizzle ORM for all DB queries — no raw SQL in app code
- oRPC for type-safe API procedures
- Hono for HTTP middleware and streaming routes
- Tool safety: only SELECT/WITH queries allowed via `execute_query`
- Quote all SQL identifiers: `"schema"."table"."column"`

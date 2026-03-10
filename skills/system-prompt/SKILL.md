---
name: system-prompt
description: Edit or improve the AI system prompt used in DBX Studio's AI chat. Invoke when the user wants to change how the AI responds, its tone, tool usage order, or response format.
source:
  type: repository
  repository: Dbxstudio/dbx-studio
---

# System Prompt Editor — DBX Studio

## Prompt Locations

There are **two** system prompts in this project:

### 1. Streaming Prompt (main, used in production)
**File**: [apps/api/src/routes/ai-stream.ts](../../../apps/api/src/routes/ai-stream.ts)
**Lines**: ~132–172 (with schema) and ~176–202 (without schema)
**Variable**: `contextPrompt` (built inline, not a constant)

### 2. oRPC Provider Prompt (used in `callAnthropicWithTools`, `callOpenAIWithTools`)
**File**: [apps/api/src/orpc/routers/ai/providersWithTools.ts](../../../apps/api/src/orpc/routers/ai/providersWithTools.ts)
**Variable**: `SYSTEM_PROMPT_WITH_TOOLS` (top of file)

## Current Prompt Structure (Streaming)

```
You are a SQL assistant...
## Tools Available    ← list 5 tools
## Response Style     ← 5 rules: be direct, show results, use tools, minimal explanation, SQL format
## Examples           ← 2-3 concrete input/output examples
## Context            ← dynamic schema from generateSQLPrompt()
Schema: "<schema>"
## User Query         ← the actual user message
```

## Prompt Design Rules for DBX Studio

1. **Results first** — answer the question before showing SQL
2. **Use tools always** — never guess schema or data
3. **Be concise** — this is a data tool, not a chatbot
4. **Show SQL only when asked** — use ```sql blocks with uppercase keywords
5. **Format numbers clearly** — "**1,247 orders**" not "1247"

## When Editing the Prompt

- Keep the `## Tools Available` section in sync with actual tools in `tools.ts`
- Keep `## Examples` realistic to real user queries
- The `${enhancedPrompt}` injection must stay — it contains live schema context
- Do not remove `Schema: "${schema || 'public'}"` line — it scopes queries
- Both prompts (streaming + oRPC) should stay consistent in style

## Current Prompt Structure (as of last update)

Both prompts now follow this unified structure:

```
You are DBX Studio's AI assistant — expert SQL analyst and data explorer.

## Tools Available (ordered by when to use)
1. read_schema / get_table_schema — FIRST, when schema is unknown
2. execute_query / execute_sql_query — run SELECT/WITH queries
3. get_table_data / select_data — preview or filter rows
4. get_table_stats — distributions and row counts
5. generate_chart / generate_bar_graph — visualization
6. describe_table / get_enums — column details, enum values

## Response Rules
1. Results first — answer before explaining
2. Always use tools — never guess schema or data
3. Tool order matters (schema → query → chart)
4. Show SQL only when asked — use ```sql with UPPERCASE
5. Format numbers clearly — **bold** key values
6. No filler words

## Chart Selection Guide
[line / bar / pie / scatter / histogram guidance]

## Query Safety
[SELECT/WITH only, always LIMIT, quote identifiers]

## Context / Schema (streaming only)
{enhancedPrompt}
Schema: "{schema}"

## User Query
{query}
```

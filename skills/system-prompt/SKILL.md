---
name: system-prompt
description: "Edit or improve the AI system prompt used in DBX Studio's AI chat. Use when the user wants to change how the AI responds, its tone, tool usage order, or response format."
---

# System Prompt Editor — DBX Studio

## Prompt Locations

There are **two** system prompts in this project:

### 1. Streaming Prompt (main, used in production)
- **File**: [apps/api/src/routes/ai-stream.ts](../../../apps/api/src/routes/ai-stream.ts)
- **Lines**: ~132–172 (with schema) and ~176–202 (without schema)
- **Variable**: `contextPrompt` (built inline, not a constant)

### 2. oRPC Provider Prompt (used in `callAnthropicWithTools`, `callOpenAIWithTools`)
- **File**: [apps/api/src/orpc/routers/ai/providersWithTools.ts](../../../apps/api/src/orpc/routers/ai/providersWithTools.ts)
- **Variable**: `SYSTEM_PROMPT_WITH_TOOLS` (top of file)

## Unified Prompt Structure

Both prompts follow this structure:

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

## Editing Workflow

### Step 1: Identify which prompt to change
- **Tone, response format, tool ordering** → edit both prompts for consistency
- **Schema context injection** → streaming prompt only (`ai-stream.ts`)
- **Tool-specific behavior** → oRPC prompt only (`providersWithTools.ts`)

### Step 2: Make the edit
Follow these constraints:
- Keep `## Tools Available` in sync with actual tools in `tools.ts`
- Keep `## Examples` realistic to real user queries
- The `${enhancedPrompt}` injection must stay — it contains live schema context
- Do not remove `Schema: "${schema || 'public'}"` — it scopes queries
- Both prompts (streaming + oRPC) should stay consistent in style

### Step 3: Validate the change
1. Compare the streaming and oRPC prompts — confirm shared sections match
2. Verify all tool names in the prompt exist in `tools.ts`
3. Test with a sample query to confirm expected behavior

## Prompt Design Rules

1. **Results first** — answer the question before showing SQL
2. **Use tools always** — never guess schema or data
3. **Be concise** — this is a data tool, not a chatbot
4. **Show SQL only when asked** — use ```sql blocks with uppercase keywords
5. **Format numbers clearly** — "**1,247 orders**" not "1247"

## Example: Adding a New Response Rule

**Before** (prompt lacks chart preference):
```
## Response Rules
1. Results first — answer before explaining
```

**After** (added chart auto-suggestion):
```
## Response Rules
1. Results first — answer before explaining
2. When results have a time dimension, suggest a line chart
```

Update the rule in **both** prompt locations, then verify with: "Show me orders this month" — the AI should suggest a chart.

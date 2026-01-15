/**
 * AI Streaming Route
 * Server-Sent Events (SSE) for real-time AI query responses
 * Based on SUMR SQL Client architecture
 */

import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import consola from 'consola'
import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpAgent } from 'http'
import { Agent as HttpsAgent } from 'https'
import aiDatabase from '~/lib/ai-database'
import {
    createDatabaseQueryTool,
    createSchemaInspectionTool,
    createBarGraphTool,
    createGetEnumsTool,
    createSelectDataTool,
    executeSQLQuery,
    inspectDatabaseSchema,
    generateBarGraph,
    getEnums,
    selectData,
    generateSQLPrompt,
    formatToolResult
} from '~/lib/db-tools'

const app = new Hono()

// Main Server URL for DBX Agent
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'https://fp9waphqm5.us-east-1.awsapprunner.com/api/v1'

/**
 * Map provider to service_id
 */
function getServiceId(provider: string): number {
    switch (provider) {
        case 'bedrock': return 1
        case 'openai': return 2
        case 'claude': return 3
        case 'qwen': return 4
        case 'ollama': return 5
        case 'gemini': return 6
        case 'groq': return 7
        case 'dbx-agent': return 8
        default: return 1 // Default to bedrock
    }
}

/**
 * Get service name from service_id
 */
function getServiceName(serviceId: number): string {
    switch (serviceId) {
        case 1: return 'bedrock'
        case 2: return 'openai'
        case 3: return 'anthropic'
        case 4: return 'qwen'
        case 5: return 'ollama'
        case 6: return 'gemini'
        case 7: return 'groq'
        case 8: return 'dbx-agent'
        default: return 'unknown'
    }
}

app.post('/query-stream', async (c) => {
    const body = await c.req.json() as {
        query: string
        connection_id?: string
        database?: string
        schema?: string
        tables?: string[]
        model?: string
        provider?: string
        session_id?: string
        AWS_ACCESS_KEY_ID?: string
        AWS_SECRET_ACCESS_KEY?: string
        AWS_REGION?: string
        ANTHROPIC_API_KEY?: string
        OPENAI_API_KEY?: string
    }

    const {
        query,
        connection_id,
        database,
        schema,
        tables,
        model,
        provider = 'bedrock',
        session_id,
        AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY,
        AWS_REGION,
        ANTHROPIC_API_KEY,
        OPENAI_API_KEY
    } = body

    // Extract auth token
    const authHeader = c.req.header('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    const serviceId = getServiceId(provider)

    consola.info(`🔵 Streaming AI query: ${provider} (${model || 'default'}), Connection: ${connection_id || 'none'}`)

    return stream(c, async (stream) => {
        try {
            // Skip session creation for now - it uses old Sequelize models
            // TODO: Migrate to Drizzle-based session management
            const sessionId = session_id

            // Build context and tools
            const tools: any[] = []
            let contextPrompt = query

            if (connection_id) {
                // Add all database tools (matching SUMR)
                tools.push(createSchemaInspectionTool(schema))      // get_table_schema
                tools.push(createDatabaseQueryTool(connection_id))  // execute_sql_query
                tools.push(createBarGraphTool())              // generate_bar_graph
                tools.push(createGetEnumsTool())              // get_enums
                tools.push(createSelectDataTool())            // select_data

                // Generate enhanced prompt with schema context
                try {
                    const enhancedPrompt = await generateSQLPrompt(query, connection_id, tables)
                    // Build a concise system prompt focused on results
                    contextPrompt = `You are a SQL assistant that helps users query databases. Be concise and results-focused.

## Tools Available
- **get_table_schema**: Get table structure (columns, types)
- **execute_sql_query**: Run SQL and get results
- **generate_bar_graph**: Create charts
- **get_enums**: Get enum values
- **select_data**: Query with filters

## Response Style

1. **Be Direct** - When asked a question like "how many users?", answer with the result first: "There are 28 users." Don't explain what a COUNT query does.

2. **Show Results Clearly** - For data queries, present results immediately. The UI will show the data table.

3. **Use Tools** - Always use tools to get data. Don't guess.

4. **Minimal Explanation** - Only explain complex queries or if the user asks "how" or "why".

5. **SQL Format** - When showing SQL, use \`\`\`sql blocks. Use uppercase keywords.

## Examples of Good Responses

User: "How many users do we have?"
→ Execute COUNT query, then say: "You have **28 users** in the database."

User: "Show me top 5 orders"
→ Execute query, then say: "Here are the top 5 orders:" (data shown in UI)

User: "What tables exist?"
→ Use get_table_schema, then list tables briefly.

## Context
${enhancedPrompt}

Schema: "${schema || 'public'}"

## User Query
${query}

Remember: Be concise. Users want results, not explanations of how SQL works.`
                } catch (error) {
                    consola.warn(`Failed to enhance prompt:`, error)
                    // Use concise prompt even without schema
                    contextPrompt = `You are a SQL assistant that helps users query databases. Be concise and results-focused.

## Tools Available
- **get_table_schema**: Get table structure (columns, types)
- **execute_sql_query**: Run SQL and get results
- **generate_bar_graph**: Create charts
- **get_enums**: Get enum values
- **select_data**: Query with filters

## Response Style

1. **Be Direct** - Answer with results first. Don't explain what SQL is or how queries work.

2. **Show Results Clearly** - The UI will display data tables automatically.

3. **Use Tools** - Always use tools to get data. Don't guess.

4. **Minimal Explanation** - Only explain if asked.

5. **SQL Format** - Use \`\`\`sql blocks with uppercase keywords.

Schema: "${schema || 'public'}"

## User Query
${query}

Remember: Be concise. Users want results, not explanations.`
                }
            }

            // Send tools info to client
            await stream.write(`data: ${JSON.stringify({ type: 'tools', tools: tools.map(t => t.name) })}\n\n`)

            const modelName = model || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

            // Route to appropriate provider based on service_id
            if (serviceId === 1) {
                // AWS Bedrock with tool support

                if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: 'AWS credentials required for Bedrock' })}\n\n`)
                    return
                }

                // Create HTTP agent with keep-alive and no HTTP/2
                const httpsAgent = new HttpsAgent({
                    keepAlive: true,
                    keepAliveMsecs: 1000,
                    maxSockets: 50,
                    maxFreeSockets: 10,
                    timeout: 120000, // 2 minutes
                    // Force HTTP/1.1 by not enabling ALPN for HTTP/2
                })

                // Configure Bedrock client with NodeHttpHandler to avoid HTTP/2 issues
                const bedrockClient = new BedrockRuntimeClient({
                    region: AWS_REGION || 'us-east-1',
                    credentials: {
                        accessKeyId: AWS_ACCESS_KEY_ID,
                        secretAccessKey: AWS_SECRET_ACCESS_KEY,
                    },
                    requestHandler: new NodeHttpHandler({
                        httpsAgent,
                        connectionTimeout: 30000, // 30 seconds
                        requestTimeout: 120000,   // 2 minutes for streaming
                    }),
                    maxAttempts: 3, // Retry up to 3 times
                })

                // Verify credentials are present
                if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
                    consola.error('❌ Missing AWS credentials')
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: 'AWS credentials are required for Bedrock' })}\n\n`)
                    return
                }

                // Convert tools to Bedrock format
                const bedrockTools = tools.map(tool => ({
                    toolSpec: {
                        name: tool.name,
                        description: tool.description,
                        inputSchema: {
                            json: tool.input_schema
                        }
                    }
                }))

                let conversationMessages: any[] = [
                    {
                        role: 'user',
                        content: [{ text: contextPrompt }],
                    },
                ]

                let fullText = ''
                let maxIterations = 10  // Increased from 5 to allow more tool interactions
                let iteration = 0

                // Keep-alive heartbeat to prevent timeouts
                const heartbeatInterval = setInterval(async () => {
                    try {
                        await stream.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`)
                    } catch (e) {
                        // Ignore errors, stream might be closed
                    }
                }, 5000) // Send heartbeat every 5 seconds

                try {
                    // Agent loop: continue until we get a final answer or hit max iterations
                    while (iteration < maxIterations) {
                        iteration++

                        const commandConfig: any = {
                            modelId: modelName,
                            messages: conversationMessages,
                            inferenceConfig: {
                                maxTokens: 4096,
                                temperature: 0.1,  // Lower temperature for more consistent tool use
                            },
                        }

                        // Add tools if available - tool choice is critical
                        if (bedrockTools.length > 0) {
                            const toolConfig: any = {
                                tools: bedrockTools
                            }
                            // Force tool use on first iteration if we have tools
                            if (iteration === 1 && connection_id) {
                                toolConfig.toolChoice = { any: {} }
                            }
                            commandConfig.toolConfig = toolConfig
                        }

                        // Debug: Log the full conversation structure before sending
                        consola.info(`📤 Iteration ${iteration}: Sending ${conversationMessages.length} messages to Bedrock`)
                        conversationMessages.forEach((msg, idx) => {
                            const contentSummary = Array.isArray(msg.content)
                                ? msg.content.map((c: any) => {
                                    if (c.text !== undefined) return `text(${String(c.text).substring(0, 20)}...)`
                                    if (c.toolUse) return `toolUse(${c.toolUse.name}, id=${c.toolUse.toolUseId})`
                                    if (c.toolResult) return `toolResult(id=${c.toolResult.toolUseId})`
                                    return Object.keys(c)[0]
                                }).join(', ')
                                : typeof msg.content
                            consola.info(`  [${idx}] ${msg.role}: [${contentSummary}]`)
                        })

                        const command = new ConverseStreamCommand(commandConfig)

                        let response
                        try {
                            response = await bedrockClient.send(command)
                        } catch (bedrockError: any) {
                            consola.error(`❌ Bedrock API call failed:`, bedrockError)
                            consola.error(`   Error name: ${bedrockError.name}`)
                            consola.error(`   Error message: ${bedrockError.message}`)
                            if (bedrockError.$metadata) {
                                consola.error(`   HTTP Status: ${bedrockError.$metadata.httpStatusCode}`)
                                consola.error(`   Request ID: ${bedrockError.$metadata.requestId}`)
                            }
                            throw bedrockError
                        }

                        let assistantContent: any[] = []
                        let stopReason = ''
                        let currentText = ''

                        if (response.stream) {
                            let isInTextBlock = false

                            for await (const event of response.stream) {
                                // Content block start
                                if (event.contentBlockStart?.start) {
                                    const start = event.contentBlockStart.start as any
                                    if (start.toolUse) {
                                        // Starting a tool use block
                                        assistantContent.push({
                                            toolUse: {
                                                toolUseId: start.toolUse.toolUseId,
                                                name: start.toolUse.name,
                                                input: '',  // Initialize as empty string for JSON accumulation
                                                _rawInput: ''  // Store raw JSON string
                                            }
                                        })
                                        isInTextBlock = false
                                    } else {
                                        // Starting a text block
                                        isInTextBlock = true
                                        currentText = ''
                                    }
                                }

                                // Text delta
                                if (event.contentBlockDelta?.delta?.text) {
                                    const text = event.contentBlockDelta.delta.text
                                    currentText += text
                                    fullText += text
                                    await stream.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`)
                                }

                                // Tool use input delta - accumulate as string
                                if (event.contentBlockDelta?.delta?.toolUse?.input) {
                                    const inputDelta = event.contentBlockDelta.delta.toolUse.input
                                    const lastTool = assistantContent[assistantContent.length - 1]
                                    if (lastTool?.toolUse) {
                                        // Convert input delta to string and accumulate
                                        const deltaStr = typeof inputDelta === 'string'
                                            ? inputDelta
                                            : JSON.stringify(inputDelta)
                                        lastTool.toolUse._rawInput += deltaStr
                                    }
                                }

                                // Content block stop - finalize the current block
                                if (event.contentBlockStop) {
                                    const lastBlock = assistantContent[assistantContent.length - 1]

                                    // If it was a tool use block, parse the input
                                    if (lastBlock?.toolUse && lastBlock.toolUse._rawInput) {
                                        try {
                                            lastBlock.toolUse.input = JSON.parse(lastBlock.toolUse._rawInput)
                                        } catch (e) {
                                            consola.error('Failed to parse accumulated tool input:', lastBlock.toolUse._rawInput)
                                            lastBlock.toolUse.input = {}
                                        }
                                        delete lastBlock.toolUse._rawInput
                                    }

                                    // If it was a text block and we have text, add it to content
                                    if (isInTextBlock && currentText) {
                                        assistantContent.push({ text: currentText })
                                        currentText = ''
                                        isInTextBlock = false
                                    }
                                }

                                // Stop reason
                                if (event.messageStop?.stopReason) {
                                    stopReason = event.messageStop.stopReason
                                }
                            }
                        }

                        // Add any remaining text content
                        if (currentText && !assistantContent.some((c: any) => c.text === currentText)) {
                            assistantContent.push({ text: currentText })
                        }

                        // CRITICAL: Reorder content blocks to put text BEFORE toolUse blocks
                        // Bedrock/Claude API requires text blocks to come before toolUse blocks
                        // when they appear in the same assistant message
                        const textBlocks = assistantContent.filter((c: any) => c.text !== undefined)
                        const toolUseBlocks = assistantContent.filter((c: any) => c.toolUse)
                        const reorderedContent = [...textBlocks, ...toolUseBlocks]

                        // Always add assistant message to maintain conversation flow
                        // Even if empty, Bedrock requires it for proper message sequencing
                        const assistantMessage = {
                            role: 'assistant',
                            content: reorderedContent.length > 0 ? reorderedContent : [{ text: '' }]
                        }

                        consola.info(`📝 Adding assistant message with ${reorderedContent.length} content blocks (reordered: ${textBlocks.length} text + ${toolUseBlocks.length} toolUse)`)
                        reorderedContent.forEach((block, idx) => {
                            if (block.text !== undefined) consola.info(`    [${idx}] text: ${String(block.text).substring(0, 50)}...`)
                            if (block.toolUse) consola.info(`    [${idx}] toolUse: ${block.toolUse.name} (id=${block.toolUse.toolUseId})`)
                        })

                        conversationMessages.push(assistantMessage)

                        // Check if we need to execute tools
                        const toolUses = toolUseBlocks

                        consola.info(`📊 Response: stopReason=${stopReason}, toolUses=${toolUses.length}, contentBlocks=${reorderedContent.length}`)

                        // CRITICAL: If we have tool uses, we MUST execute them and add results
                        // Otherwise Bedrock will error on the next iteration
                        if (toolUses.length > 0) {
                            if (stopReason !== 'tool_use') {
                                consola.warn(`⚠️ Tool uses found but stop reason is '${stopReason}', forcing tool execution`)
                            }

                            consola.info(`🔧 Executing ${toolUses.length} tools`)

                            // Execute each tool
                            const toolResults: any[] = []
                            for (const block of toolUses) {
                                const toolUse = block.toolUse
                                const toolName = toolUse.name
                                const toolInput = toolUse.input

                                // Send tool_call event to client so UI can show what tool is being called
                                await stream.write(`data: ${JSON.stringify({
                                    type: 'tool_call',
                                    toolName: toolName,
                                    args: toolInput,
                                    toolUseId: toolUse.toolUseId
                                })}\n\n`)

                                let toolResult: any
                                try {
                                    if (toolName === 'execute_sql_query') {
                                        toolResult = await executeSQLQuery(connection_id!, toolInput.query, toolInput.database)
                                    } else if (toolName === 'get_table_schema' || toolName === 'inspect_database_schema') {
                                        // Use the schema from request if not provided in toolInput
                                        const schemaToUse = toolInput.schema || schema
                                        toolResult = await inspectDatabaseSchema(connection_id!, toolInput.table_names || toolInput.table_name, schemaToUse)
                                    } else if (toolName === 'generate_bar_graph') {
                                        toolResult = await generateBarGraph(
                                            connection_id!,
                                            toolInput.query,
                                            toolInput.x_column,
                                            toolInput.y_column,
                                            toolInput.title,
                                            toolInput.x_label,
                                            toolInput.y_label,
                                            toolInput.color,
                                            toolInput.orientation
                                        )
                                    } else if (toolName === 'get_enums') {
                                        toolResult = await getEnums(connection_id!)
                                    } else if (toolName === 'select_data') {
                                        toolResult = await selectData(
                                            connection_id!,
                                            toolInput.tableAndSchema,
                                            toolInput.whereConcatOperator,
                                            toolInput.whereFilters,
                                            toolInput.select,
                                            toolInput.limit,
                                            toolInput.offset,
                                            toolInput.orderBy
                                        )
                                    } else {
                                        toolResult = { error: `Unknown tool: ${toolName}` }
                                    }
                                } catch (error: any) {
                                    toolResult = { error: error.message }
                                }

                                // Format a summary of the result for display
                                let responseSummary = 'Completed successfully'
                                let resultData = null

                                if (toolResult.error) {
                                    responseSummary = toolResult.error
                                } else if (toolName === 'execute_sql_query' && toolResult.data) {
                                    // For SQL queries, include the actual data in the response
                                    const rows = Array.isArray(toolResult.data) ? toolResult.data : toolResult.data.rows || []
                                    const rowCount = rows.length

                                    if (rowCount === 0) {
                                        responseSummary = 'Query returned no results'
                                    } else if (rowCount === 1) {
                                        // For single row results (like COUNT), show the value directly
                                        const row = rows[0]
                                        const keys = Object.keys(row)
                                        if (keys.length === 1) {
                                            responseSummary = `Result: ${row[keys[0]]}`
                                        } else {
                                            responseSummary = `1 row returned`
                                        }
                                        resultData = rows
                                    } else {
                                        responseSummary = `${rowCount} rows returned`
                                        resultData = rows.slice(0, 10) // Send first 10 rows for preview
                                    }
                                } else if (toolName === 'get_table_schema' || toolName === 'inspect_database_schema') {
                                    const tables = toolResult.data?.tables || []
                                    responseSummary = `Found ${tables.length} table(s)`
                                }

                                // Send tool_response event to client with actual data
                                await stream.write(`data: ${JSON.stringify({
                                    type: 'tool_response',
                                    toolName: toolName,
                                    toolUseId: toolUse.toolUseId,
                                    success: !toolResult.error,
                                    response: responseSummary,
                                    data: resultData // Include actual data for display
                                })}\n\n`)

                                // Truncate large results to avoid timeouts
                                let processedResult = toolResult
                                const resultStr = JSON.stringify(toolResult)

                                // If result is larger than 50KB, truncate it
                                if (resultStr.length > 50000) {
                                    // For schema results, keep only first 10 tables/columns
                                    if (toolResult.success && toolResult.data?.tables) {
                                        processedResult = {
                                            ...toolResult,
                                            data: {
                                                ...toolResult.data,
                                                tables: toolResult.data.tables.slice(0, 10).map((t: any) => ({
                                                    ...t,
                                                    columns: t.columns?.slice(0, 20) || []
                                                })),
                                                _truncated: true,
                                                _originalCount: toolResult.data.tables.length
                                            }
                                        }
                                    } else if (toolResult.success && toolResult.data?.rows) {
                                        // For query results, keep only first 100 rows
                                        processedResult = {
                                            ...toolResult,
                                            data: toolResult.data.slice(0, 100),
                                            _truncated: true,
                                            _originalCount: toolResult.data.length
                                        }
                                    }
                                }

                                // Format tool result for AWS Bedrock Converse API
                                toolResults.push({
                                    toolResult: {
                                        toolUseId: toolUse.toolUseId,
                                        content: [{ json: processedResult }]
                                    }
                                })
                            }

                            // Add tool results to conversation
                            conversationMessages.push({
                                role: 'user',
                                content: toolResults
                            })

                            // Small delay before next iteration to avoid HTTP/2 issues
                            await new Promise(resolve => setTimeout(resolve, 100))

                            // Continue loop to get next response with tool results
                            continue
                        }

                        // No more tool use, break the loop
                        break
                    }

                    await stream.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                } catch (agentError: any) {
                    consola.error(`❌ Agent loop error: ${agentError.message}`)
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: agentError.message })}\n\n`)
                } finally {
                    clearInterval(heartbeatInterval)
                }

            } else if (serviceId === 2) {
                // OpenAI
                if (!OPENAI_API_KEY) {
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: 'OpenAI API key required' })}\n\n`)
                    return
                }

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [{ role: 'user', content: contextPrompt }],
                        stream: true,
                        temperature: 0.3,
                        max_tokens: 4096,
                    }),
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: `OpenAI error: ${errorText}` })}\n\n`)
                    return
                }

                const reader = response.body?.getReader()
                if (!reader) {
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: 'No response body' })}\n\n`)
                    return
                }

                const decoder = new TextDecoder()
                let buffer = ''
                let fullText = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim()
                            if (data === '[DONE]') continue

                            try {
                                const parsed = JSON.parse(data)
                                const text = parsed.choices?.[0]?.delta?.content
                                if (text) {
                                    fullText += text
                                    await stream.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`)
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                }

                consola.success(`✅ OpenAI streaming complete, total length: ${fullText.length}`)
                await stream.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)

            } else if (serviceId === 3) {
                // Anthropic Claude
                if (!ANTHROPIC_API_KEY) {
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: 'Anthropic API key required' })}\n\n`)
                    return
                }

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [{ role: 'user', content: contextPrompt }],
                        stream: true,
                        max_tokens: 4096,
                        temperature: 0.3,
                    }),
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: `Anthropic error: ${errorText}` })}\n\n`)
                    return
                }

                const reader = response.body?.getReader()
                if (!reader) {
                    await stream.write(`data: ${JSON.stringify({ type: 'error', error: 'No response body' })}\n\n`)
                    return
                }

                const decoder = new TextDecoder()
                let buffer = ''
                let fullText = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim()

                            try {
                                const parsed = JSON.parse(data)
                                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                    const text = parsed.delta.text
                                    fullText += text
                                    await stream.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`)
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                }

                consola.success(`✅ Anthropic streaming complete, total length: ${fullText.length}`)
                await stream.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)

            } else {
                await stream.write(`data: ${JSON.stringify({ type: 'error', error: `Unsupported provider: ${provider}` })}\n\n`)
            }

        } catch (error: any) {
            consola.error(`❌ Streaming error:`, error)
            await stream.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
        }
    })
})

/**
 * POST /ai/query
 * Non-streaming AI query endpoint
 */
app.post('/query', async (c) => {
    const body = await c.req.json() as {
        query: string
        connection_id?: string
        database?: string
        schema?: string
        tables?: string[]
        model?: string
        provider?: string
        session_id?: string
    }

    const { query, connection_id, database, schema, tables, model, provider = 'dbx-agent', session_id } = body

    // Extract auth token
    const authHeader = c.req.header('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token && provider === 'dbx-agent') {
        return c.json({
            success: false,
            error: 'Authentication required for DBX Agent'
        }, 401)
    }

    try {
        consola.info(`🔵 AI query: "${query.substring(0, 50)}..."`)

        // Skip session creation - uses old Sequelize models
        const sessionId = session_id

        // Build context
        let contextPrompt = query
        if (connection_id) {
            try {
                contextPrompt = await generateSQLPrompt(query, connection_id, tables)
            } catch (error) {
                consola.warn(`Failed to enhance prompt:`, error)
                // Continue with original query
            }
        }

        const modelName = model || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

        const requestBody: any = {
            prompt: contextPrompt,
            model_id: modelName
        }

        if (connection_id) {
            requestBody.connection_id = connection_id
        }

        if (tables && tables.length > 0) {
            requestBody.tables = tables
        }

        const response = await fetch(`${MAIN_SERVER_URL}/llm-inference/dbx-multi-service-inference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            return c.json({
                success: false,
                error: `API error: ${errorText}`
            }, response.status as any)
        }

        const json = await response.json() as any
        const text = json.results?.[0]?.output || json.output || json.text || JSON.stringify(json)

        // Skip conversation saving - uses old Sequelize models
        // TODO: Migrate to Drizzle-based conversation storage

        return c.json({
            success: true,
            message: text,
            session_id: sessionId
        })

    } catch (error: any) {
        consola.error(`❌ Query error:`, error)
        return c.json({
            success: false,
            error: error.message
        }, 500)
    }
})

/**
 * GET /ai/sessions/:connection_id
 * Get all sessions for a connection
 */
app.get('/sessions/:connection_id', async (c) => {
    const connectionId = parseInt(c.req.param('connection_id'))

    try {
        // This would need to be implemented in ai-database.ts
        return c.json({
            success: true,
            sessions: []
        })
    } catch (error: any) {
        return c.json({
            success: false,
            error: error.message
        }, 500)
    }
})

/**
 * GET /ai/conversations/:session_id
 * Get conversation history for a session
 */
app.get('/conversations/:session_id', async (c) => {
    const sessionId = c.req.param('session_id')

    try {
        // Skip conversation loading - uses old Sequelize models
        // TODO: Migrate to Drizzle-based conversation storage
        return c.json({
            success: true,
            messages: []
        })
    } catch (error: any) {
        return c.json({
            success: false,
            error: error.message
        }, 500)
    }
})

export { app as aiStreamRoutes }

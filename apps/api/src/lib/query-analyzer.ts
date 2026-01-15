/**
 * Query Analyzer - Intelligent LLM-based complexity analysis and routing
 * Based on SUMR AI SQL Client query-analyzer.js
 */

import consola from 'consola'

// Query complexity analysis result
export interface ComplexityAnalysis {
    isComplex: boolean
    confidence: number
    reason: string
    estimatedTables: number
    estimatedJoins: number
    analysisMethod: 'llm' | 'fallback-default' | 'heuristic'
}

// Routing decision
export interface RoutingDecision {
    useComplexModel: boolean
    useThinkingMode: boolean
    reason: string
}

/**
 * Analyze query complexity using heuristic rules
 * (LLM-based analysis can be added later if local model is available)
 */
export function analyzeQueryComplexity(query: string): ComplexityAnalysis {
    const queryLower = query.toLowerCase()

    // Count keywords that indicate complexity
    const joinCount = (queryLower.match(/\bjoin\b/g) || []).length
    const tableMatches = queryLower.match(/\bfrom\b\s+(\w+)|join\s+(\w+)/g) || []
    const estimatedTables = Math.max(1, tableMatches.length)

    // Complexity indicators
    const hasMultipleJoins = joinCount >= 2
    const hasSubquery = queryLower.includes('select') &&
                       (queryLower.match(/select/g) || []).length > 1
    const hasCTE = queryLower.includes('with') && queryLower.includes('as (')
    const hasAggregation = /\b(count|sum|avg|min|max|group by|having)\b/.test(queryLower)
    const hasComplexAggregation = queryLower.includes('group by') && queryLower.includes('having')
    const has3PlusTables = estimatedTables >= 3

    // Calculate complexity score
    let complexityScore = 0
    if (hasMultipleJoins) complexityScore += 40
    if (hasSubquery) complexityScore += 30
    if (hasCTE) complexityScore += 35
    if (hasComplexAggregation) complexityScore += 25
    else if (hasAggregation) complexityScore += 15
    if (has3PlusTables) complexityScore += 30

    const isComplex = complexityScore >= 50

    // Build reason
    const reasons: string[] = []
    if (hasMultipleJoins) reasons.push(`${joinCount} JOINs`)
    if (hasSubquery) reasons.push('subqueries')
    if (hasCTE) reasons.push('CTEs')
    if (hasComplexAggregation) reasons.push('complex aggregation')
    if (has3PlusTables) reasons.push(`${estimatedTables} tables`)

    const reason = isComplex
        ? `Complex query detected: ${reasons.join(', ')}`
        : `Simple query (${estimatedTables} ${estimatedTables === 1 ? 'table' : 'tables'}, ${joinCount} ${joinCount === 1 ? 'JOIN' : 'JOINs'})`

    const confidence = isComplex ? Math.min(95, 70 + complexityScore / 2) : Math.min(95, 80 - complexityScore / 2)

    consola.info(`[Query Analyzer] ${reason} (${confidence}% confidence)`)

    return {
        isComplex,
        confidence,
        reason,
        estimatedTables,
        estimatedJoins: joinCount,
        analysisMethod: 'heuristic'
    }
}

/**
 * Build Text-to-SQL prompt with thinking process
 */
export function buildThinkingPrompt(query: string, schemaText: string = ''): string {
    if (schemaText) {
        // With database schema
        return `You are a Text-to-SQL expert. Convert natural language to SQL.

DATABASE SCHEMA:
${schemaText}

QUERY: ${query}

MANDATORY INSTRUCTIONS - Your response must have TWO parts:

PART 1 - REASONING (Required):
Think deeply and explain your reasoning process in EXTENSIVE DETAIL. Write as much as you need - there is NO length limit. Start with "REASONING:"

Be THOROUGH and COMPREHENSIVE. Explain every step of your thinking process, including:
- Why you're making each decision
- Alternative approaches you considered
- Edge cases and how to handle them
- Step-by-step breakdown of your logic

You MUST analyze:
- What tables are mentioned and their relationships?
- What columns exist in each table?
- What JOINs are needed and why?
- What is the join condition and why?
- What aggregations are needed (COUNT, SUM, AVG, etc.)?
- What GROUP BY clauses are needed and why?
- What HAVING or WHERE filters are needed?
- Are there any edge cases to consider?
- What is the final query structure?

PART 2 - SQL (Required):
After your detailed reasoning, provide the final SQL query. Start with "SQL:"

EXAMPLE:
REASONING:
Let me analyze this query step by step:

The query asks for users who purchased more than 5 products. Let me break this down:

1. **Tables involved**:
   - users table contains user information (user_id, username)
   - products table contains product information with user_id

2. **Relationship**:
   - Products are linked to users via user_id foreign key
   - One-to-many relationship (one user can have many products)

3. **JOIN needed**:
   - INNER JOIN products ON users.user_id = products.user_id

4. **Aggregation**:
   - COUNT how many products each user has
   - GROUP BY user_id and username

5. **Filtering**:
   - HAVING COUNT(*) > 5 to filter users with more than 5 products

SQL:
SELECT u.user_id, u.username
FROM users u
INNER JOIN products p ON u.user_id = p.user_id
GROUP BY u.user_id, u.username
HAVING COUNT(*) > 5;

NOW GENERATE YOUR DETAILED TWO-PART RESPONSE:`
    } else {
        // Without schema
        return `You are a Text-to-SQL expert. Convert natural language to SQL.

QUERY: ${query}

MANDATORY INSTRUCTIONS - Your response must have TWO parts:

PART 1 - REASONING (Required):
First explain your step-by-step reasoning process in EXTENSIVE DETAIL. Start with "REASONING:"

PART 2 - SQL (Required):
Then provide the SQL query. Start with "SQL:"

NOW GENERATE YOUR TWO-PART RESPONSE:`
    }
}

/**
 * Extract thinking and SQL from thinking mode response
 */
export function extractThinkingAndSQL(fullResponse: string): {
    thinking: string
    sql: string
} {
    let thinking = ''
    let sql = ''

    try {
        // Extract thinking section
        const thinkingMatch = fullResponse.match(/REASONING:\s*([\s\S]*?)(?=SQL:|$)/i)
        if (thinkingMatch) {
            thinking = thinkingMatch[1].trim()
        }

        // Extract SQL section
        const sqlMatch = fullResponse.match(/SQL:\s*([\s\S]*?)$/i)
        if (sqlMatch) {
            sql = sqlMatch[1].trim()
        }

        // Clean up SQL - remove markdown code blocks if present
        sql = sql
            .replace(/```sql/gi, '')
            .replace(/```/g, '')
            .trim()

    } catch (error) {
        consola.error('[Query Analyzer] Error extracting thinking/SQL:', error)
    }

    return { thinking, sql }
}

/**
 * Determine routing based on analysis
 */
export function determineRouting(
    analysis: ComplexityAnalysis,
    autoRouteComplex: boolean = true
): RoutingDecision {
    if (!autoRouteComplex) {
        return {
            useComplexModel: false,
            useThinkingMode: false,
            reason: 'Auto-routing disabled'
        }
    }

    const useComplexModel = analysis.isComplex
    const useThinkingMode = analysis.isComplex

    return {
        useComplexModel,
        useThinkingMode,
        reason: analysis.isComplex
            ? `Complex query detected (${analysis.estimatedTables} tables, ${analysis.estimatedJoins} joins)`
            : 'Simple query detected (1-2 tables)'
    }
}

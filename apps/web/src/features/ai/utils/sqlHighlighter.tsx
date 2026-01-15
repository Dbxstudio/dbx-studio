import { ReactNode } from 'react'

/**
 * SQL keywords to highlight
 */
const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON',
    'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE',
    'NULL', 'NOT', 'DEFAULT', 'AUTO_INCREMENT', 'SERIAL',
    'AS', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'COALESCE', 'NULLIF',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'CONVERT',
    'TRUE', 'FALSE', 'IS', 'LIKE', 'ILIKE', 'BETWEEN', 'WITH', 'RECURSIVE'
]

/**
 * Apply SQL syntax highlighting
 * Colors keywords, strings, numbers, and comments for better readability
 */
export function highlightSQL(sql: string): ReactNode[] {
    if (!sql) return [sql]

    const elements: ReactNode[] = []
    let key = 0

    let i = 0
    let currentToken = ''
    let inString = false
    let stringChar = ''
    let inComment = false
    let commentType = ''

    const keywordPattern = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'i')

    const flushToken = () => {
        if (currentToken) {
            // Check if it's a keyword
            if (keywordPattern.test(currentToken)) {
                elements.push(
                    <span key={key++} className="sql-keyword">
                        {currentToken}
                    </span>
                )
            } else if (/^\d+(?:\.\d+)?$/.test(currentToken)) {
                // Number
                elements.push(
                    <span key={key++} className="sql-number">
                        {currentToken}
                    </span>
                )
            } else {
                elements.push(currentToken)
            }
            currentToken = ''
        }
    }

    while (i < sql.length) {
        const char = sql[i]
        const nextChar = sql[i + 1]

        if (inString) {
            currentToken += char
            if (char === stringChar && sql[i - 1] !== '\\') {
                // End of string
                elements.push(
                    <span key={key++} className="sql-string">
                        {currentToken}
                    </span>
                )
                currentToken = ''
                inString = false
            }
            i++
            continue
        }

        if (inComment) {
            currentToken += char
            if (commentType === '--' && char === '\n') {
                elements.push(
                    <span key={key++} className="sql-comment">
                        {currentToken}
                    </span>
                )
                currentToken = ''
                inComment = false
            } else if (commentType === '/*' && char === '*' && nextChar === '/') {
                currentToken += nextChar
                i++
                elements.push(
                    <span key={key++} className="sql-comment">
                        {currentToken}
                    </span>
                )
                currentToken = ''
                inComment = false
            }
            i++
            continue
        }

        // Check for string start
        if (char === "'" || char === '"') {
            flushToken()
            inString = true
            stringChar = char
            currentToken = char
            i++
            continue
        }

        // Check for comment start
        if (char === '-' && nextChar === '-') {
            flushToken()
            inComment = true
            commentType = '--'
            currentToken = char
            i++
            continue
        }

        if (char === '/' && nextChar === '*') {
            flushToken()
            inComment = true
            commentType = '/*'
            currentToken = char
            i++
            continue
        }

        // Check for word boundaries
        if (/\s|[(),;.]/.test(char)) {
            flushToken()
            elements.push(char)
            i++
            continue
        }

        currentToken += char
        i++
    }

    // Flush remaining token
    flushToken()

    // Handle any remaining string or comment
    if (currentToken) {
        if (inString) {
            elements.push(
                <span key={key++} className="sql-string">
                    {currentToken}
                </span>
            )
        } else if (inComment) {
            elements.push(
                <span key={key++} className="sql-comment">
                    {currentToken}
                </span>
            )
        }
    }

    return elements.length > 0 ? elements : [sql]
}

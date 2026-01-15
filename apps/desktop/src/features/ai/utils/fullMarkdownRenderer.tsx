import { ReactNode } from 'react'
import { formatInlineMarkdown, isMarkdownHeader, isListItem, isCodeBlockDelimiter, isTableSeparatorLine, parseTableRow, isTableRow } from './markdownFormatter'
import { highlightSQL } from './sqlHighlighter'

/**
 * Render full markdown content including tables, headers, lists, code blocks, and inline formatting
 */
export function renderFullMarkdown(text: string): ReactNode[] {
    if (!text) return [text]

    const lines = text.split('\n')
    const elements: ReactNode[] = []
    let key = 0

    let i = 0
    while (i < lines.length) {
        const line = lines[i]

        // Check for code block
        const codeBlockCheck = isCodeBlockDelimiter(line)
        if (codeBlockCheck.isDelimiter) {
            const codeLines: string[] = []
            const language = codeBlockCheck.language
            i++ // Skip opening ```

            while (i < lines.length) {
                const codeLine = lines[i]
                if (isCodeBlockDelimiter(codeLine).isDelimiter) {
                    i++ // Skip closing ```
                    break
                }
                codeLines.push(codeLine)
                i++
            }

            const codeContent = codeLines.join('\n')

            // Apply SQL highlighting if it's SQL
            if (language === 'sql' || /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/i.test(codeContent)) {
                elements.push(
                    <pre key={key++} className="markdown-code-block sql-block">
                        <code>{highlightSQL(codeContent)}</code>
                    </pre>
                )
            } else {
                elements.push(
                    <pre key={key++} className="markdown-code-block">
                        <code>{codeContent}</code>
                    </pre>
                )
            }
            continue
        }

        // Check for table
        if (isTableRow(line)) {
            const tableRows: string[][] = []
            let headers: string[] | null = null
            let foundSeparator = false

            // Collect table rows
            while (i < lines.length && (isTableRow(lines[i]) || isTableSeparatorLine(lines[i]))) {
                const currentLine = lines[i]

                if (isTableSeparatorLine(currentLine)) {
                    foundSeparator = true
                    i++
                    continue
                }

                const cells = parseTableRow(currentLine)

                if (!foundSeparator && !headers) {
                    headers = cells
                } else {
                    tableRows.push(cells)
                }

                i++
            }

            // Render table
            if (headers || tableRows.length > 0) {
                elements.push(
                    <div key={key++} className="markdown-table-wrapper">
                        <table className="markdown-table">
                            {headers && (
                                <thead>
                                    <tr>
                                        {headers.map((header, idx) => (
                                            <th key={idx}>{formatInlineMarkdown(header)}</th>
                                        ))}
                                    </tr>
                                </thead>
                            )}
                            <tbody>
                                {tableRows.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        {row.map((cell, cellIdx) => (
                                            <td key={cellIdx}>{formatInlineMarkdown(cell)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }
            continue
        }

        // Check for headers
        const headerCheck = isMarkdownHeader(line)
        if (headerCheck.isHeader) {
            const HeaderTag = `h${headerCheck.level}` as keyof JSX.IntrinsicElements
            elements.push(
                <HeaderTag key={key++} className="markdown-header">
                    {formatInlineMarkdown(headerCheck.text)}
                </HeaderTag>
            )
            i++
            continue
        }

        // Check for lists
        const listCheck = isListItem(line)
        if (listCheck.isList) {
            const listItems: { content: string; type: 'ordered' | 'unordered' }[] = []
            const listType = listCheck.type

            // Collect consecutive list items of the same type
            while (i < lines.length) {
                const itemCheck = isListItem(lines[i])
                if (!itemCheck.isList || itemCheck.type !== listType) break

                listItems.push({ content: itemCheck.content, type: itemCheck.type })
                i++
            }

            // Render list
            const ListTag = listType === 'ordered' ? 'ol' : 'ul'
            elements.push(
                <ListTag key={key++} className="markdown-list">
                    {listItems.map((item, idx) => (
                        <li key={idx}>{formatInlineMarkdown(item.content)}</li>
                    ))}
                </ListTag>
            )
            continue
        }

        // Empty line
        if (line.trim() === '') {
            elements.push(<br key={key++} />)
            i++
            continue
        }

        // Regular paragraph
        elements.push(
            <p key={key++} className="markdown-paragraph">
                {formatInlineMarkdown(line)}
            </p>
        )
        i++
    }

    return elements.length > 0 ? elements : [text]
}

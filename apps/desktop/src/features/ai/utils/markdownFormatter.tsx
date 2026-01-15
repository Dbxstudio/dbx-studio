import { ReactNode } from 'react'

/**
 * Format inline markdown (bold, italic, links, inline code)
 * Returns an array of React elements and strings
 */
export function formatInlineMarkdown(text: string): ReactNode[] {
    if (!text) return [text]

    let key = 0
    const elements: ReactNode[] = []
    let lastIndex = 0

    // Combined regex to find all markdown elements
    // Matches: `code`, **bold**, __bold__, *italic*, _italic_, [link](url)
    const combinedRegex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)|(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)|\[[^\]]+\]\([^)]+\))/g

    let match: RegExpExecArray | null
    while ((match = combinedRegex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            elements.push(text.substring(lastIndex, match.index))
        }

        const fullMatch = match[0]

        // Determine type and format
        if (fullMatch.startsWith('`')) {
            // Inline code
            const content = fullMatch.slice(1, -1)
            elements.push(
                <code
                    key={key++}
                    className="inline-code"
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: '#4a9eff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'Monaco, Consolas, monospace',
                        fontSize: '0.9em',
                    }}
                >
                    {content}
                </code>
            )
        } else if (fullMatch.startsWith('**') || fullMatch.startsWith('__')) {
            // Bold
            const content = fullMatch.slice(2, -2)
            elements.push(<strong key={key++}>{content}</strong>)
        } else if (fullMatch.startsWith('*') || fullMatch.startsWith('_')) {
            // Italic
            const content = fullMatch.slice(1, -1)
            elements.push(<em key={key++}>{content}</em>)
        } else if (fullMatch.startsWith('[')) {
            // Link
            const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(fullMatch)
            if (linkMatch) {
                elements.push(
                    <a
                        key={key++}
                        href={linkMatch[2]}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: '#4a9eff',
                            textDecoration: 'underline',
                        }}
                    >
                        {linkMatch[1]}
                    </a>
                )
            }
        }

        lastIndex = match.index + fullMatch.length
    }

    // Add remaining text
    if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex))
    }

    return elements.length > 0 ? elements : [text]
}

/**
 * Check if a line is a markdown header (starts with # ## ### etc.)
 */
export function isMarkdownHeader(line: string): { isHeader: boolean; level: number; text: string } {
    const trimmed = line.trim()
    const match = /^(#{1,6})\s+(.+)$/.exec(trimmed)

    if (match) {
        return {
            isHeader: true,
            level: match[1].length,
            text: match[2],
        }
    }

    return { isHeader: false, level: 0, text: line }
}

/**
 * Check if a line is a list item (starts with - * or 1.)
 */
export function isListItem(line: string): { isList: boolean; type: 'ordered' | 'unordered'; content: string } {
    const trimmed = line.trim()

    // Unordered list (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
        return {
            isList: true,
            type: 'unordered',
            content: trimmed.replace(/^[-*]\s+/, ''),
        }
    }

    // Ordered list (1. 2. etc.)
    if (/^\d+\.\s+/.test(trimmed)) {
        return {
            isList: true,
            type: 'ordered',
            content: trimmed.replace(/^\d+\.\s+/, ''),
        }
    }

    return { isList: false, type: 'unordered', content: line }
}

/**
 * Check if a line is a code block delimiter (```)
 */
export function isCodeBlockDelimiter(line: string): { isDelimiter: boolean; language: string } {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
        const language = trimmed.slice(3).trim().toLowerCase()
        return { isDelimiter: true, language }
    }

    return { isDelimiter: false, language: '' }
}

/**
 * Check if a line is a table separator line (e.g., |---|---|---|)
 */
export function isTableSeparatorLine(line: string): boolean {
    const trimmed = line.trim()
    // Table separator lines contain only |, -, :, and spaces
    // They should NOT contain any letters or digits
    if (!trimmed.includes('-')) return false
    if (/[a-zA-Z0-9]/.test(trimmed)) return false
    return /^\|?[\s\-:|]+\|?$/.test(trimmed)
}

/**
 * Parse a markdown table row into cells
 */
export function parseTableRow(line: string): string[] {
    const trimmed = line.trim()
    // Remove leading and trailing |, then split by |
    const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '')
    return withoutEdges.split('|').map(cell => cell.trim())
}

/**
 * Check if a line is a table row (starts with | or contains |)
 */
export function isTableRow(line: string): boolean {
    const trimmed = line.trim()
    return trimmed.includes('|') && trimmed.split('|').length >= 3
}

import type { CreateConnectionInput } from '../hooks/useConnections'

export interface ParsedBigQueryConnectionString {
    projectId: string
    keyFilename: string
    dataset?: string
}

export function buildBigQueryConnectionString(input: {
    projectId: string
    keyFilename: string
    dataset?: string
}): string {
    const projectId = input.projectId.trim()
    const params = new URLSearchParams({
        keyFilename: input.keyFilename,
    })

    if (input.dataset) {
        params.set('dataset', input.dataset)
    }

    return `bigquery://${projectId}?${params.toString()}`
}

export function parseBigQueryConnectionString(connectionString?: string): ParsedBigQueryConnectionString | null {
    if (!connectionString) return null

    try {
        const url = new URL(connectionString)
        if (url.protocol !== 'bigquery:') {
            return null
        }

        const projectId = url.hostname
        const keyFilename = url.searchParams.get('keyFilename') || ''
        const dataset = url.searchParams.get('dataset') || undefined

        if (!projectId || !keyFilename) {
            return null
        }

        return {
            projectId,
            keyFilename,
            dataset,
        }
    } catch {
        return null
    }
}

export function buildConnectionString(input: Omit<CreateConnectionInput, 'showAllDatabases' | 'requireServerRegistration' | 'serverDriver'>) {
    const username = encodeURIComponent(input.username || '')
    const password = encodeURIComponent(input.password || '')
    const host = input.host || 'localhost'
    const port = input.port || 5432
    const database = input.database || ''

    let driver: string = input.type
    let connectionString = ''

    if (input.type === 'postgresql') {
        driver = 'postgres'
        connectionString = `postgresql+asyncpg://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
    } else if (input.type === 'mysql') {
        connectionString = `mysql+asyncmy://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
    } else if (input.type === 'snowflake') {
        const account = input.account || ''
        connectionString = `snowflake://${username}:${password}@${account}${database ? '/' + database : ''}`
    } else if (input.type === 'supabase') {
        driver = 'postgres'
        if (input.connectionString) {
            connectionString = input.connectionString
        } else {
            connectionString = `postgresql+asyncpg://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
        }
    } else if (input.type === 'redshift') {
        driver = 'redshift'
        connectionString = `redshift+asyncpg://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
    } else if (input.type === 'sqlite') {
        driver = 'sqlite'
        connectionString = `sqlite+aiosqlite:///${database}`
    } else if (input.type === 'bigquery') {
        driver = 'bigquery'
        if (input.projectId && input.keyFilename) {
            connectionString = buildBigQueryConnectionString({
                projectId: input.projectId,
                keyFilename: input.keyFilename,
                dataset: input.dataset,
            })
        }
    } else {
        connectionString = `${driver}://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
    }

    return {
        connectionString,
        driver,
    }
}

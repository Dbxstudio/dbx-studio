import { BigQuery } from '@google-cloud/bigquery'

export interface BigQueryConnectionConfig {
    connectionId: string
    projectId: string
    keyFilename: string
    dataset?: string | null
}

export interface ParsedBigQueryConnectionString {
    projectId: string
    keyFilename: string
    dataset?: string
}

function normalizeKeyFilename(value: string): string {
    const trimmed = value.trim()

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1).trim()
    }

    return trimmed
}

const bigQueryClients = new Map<string, BigQuery>()

function getClientKey(connectionId: string) {
    return `bigquery:${connectionId}`
}

export function createBigQueryConnection(config: BigQueryConnectionConfig): BigQuery {
    const cacheKey = getClientKey(config.connectionId)

    if (!bigQueryClients.has(cacheKey)) {
        const client = new BigQuery({
            projectId: config.projectId,
            keyFilename: config.keyFilename,
        })
        bigQueryClients.set(cacheKey, client)
    }

    return bigQueryClients.get(cacheKey) as BigQuery
}

export function parseBigQueryConnectionString(connectionString?: string | null): ParsedBigQueryConnectionString | null {
    if (!connectionString) {
        return null
    }

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

export function resolveBigQueryConfig(connection: {
    projectId?: string | null
    keyFilename?: string | null
    dataset?: string | null
    connectionString?: string | null
}): ParsedBigQueryConnectionString | null {
    if (connection.projectId && connection.keyFilename) {
        return {
            projectId: connection.projectId,
            keyFilename: normalizeKeyFilename(connection.keyFilename),
            dataset: connection.dataset || undefined,
        }
    }

    const parsed = parseBigQueryConnectionString(connection.connectionString)
    if (!parsed) {
        return null
    }

    return {
        projectId: parsed.projectId,
        keyFilename: normalizeKeyFilename(parsed.keyFilename),
        dataset: connection.dataset || parsed.dataset,
    }
}

export function createTempBigQueryConnection(config: Omit<BigQueryConnectionConfig, 'connectionId'>): BigQuery {
    return new BigQuery({
        projectId: config.projectId,
        keyFilename: config.keyFilename,
    })
}

export async function bigQueryConnect(client: BigQuery): Promise<void> {
    await client.query({ query: 'SELECT 1' })
}

export async function bigQueryQuery(
    client: BigQuery,
    queryText: string,
    dataset?: string | null,
): Promise<Array<Record<string, unknown>>> {
    const [rows] = await client.query({
        query: queryText,
        ...(dataset ? { defaultDataset: { datasetId: dataset } } : {}),
    })

    return rows as Array<Record<string, unknown>>
}

export async function bigQuerySchemas(client: BigQuery): Promise<string[]> {
    const [datasets] = await client.getDatasets()
    return (datasets as Array<{ id?: string }>)
        .map((dataset: { id?: string }) => dataset.id)
        .filter((name: string | undefined): name is string => typeof name === 'string')
        .sort((a: string, b: string) => a.localeCompare(b))
}

export async function bigQueryTables(
    client: BigQuery,
    dataset: string,
): Promise<Array<{ name: string; type: 'table' | 'view' }>> {
    const datasetRef = client.dataset(dataset)
    const [tables] = await datasetRef.getTables()

    const withMetadata = await Promise.all(
        tables.map(async (table) => {
            const [metadata] = await table.getMetadata()
            const tableType = metadata.type === 'VIEW' ? 'view' : 'table'
            return {
                name: table.id || '',
                type: tableType as 'table' | 'view',
            }
        }),
    )

    return withMetadata
        .filter((table: { name: string; type: 'table' | 'view' }) => !!table.name)
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
}

export async function closeBigQueryConnection(connectionId: string): Promise<void> {
    const cacheKey = getClientKey(connectionId)
    bigQueryClients.delete(cacheKey)
}

export async function closeAllBigQueryConnections(): Promise<void> {
    bigQueryClients.clear()
}

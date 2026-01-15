import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db } from '~/drizzle'
import {
    createPostgresConnection,
    createMysqlConnection,
    createMssqlConnection,
    createClickHouseConnection
} from '~/kysely/connections'
import { sql } from 'kysely'

const filterSchema = z.object({
    column: z.string(),
    operator: z.enum(['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'NOT LIKE', 'ILIKE', 'NOT ILIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN']),
    values: z.array(z.any()).optional().default([]),
})

const getDataSchema = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    schema: z.string().optional().default('public'),
    page: z.number().optional().default(1),
    pageSize: z.number().optional().default(50),
    orderBy: z.string().optional(),
    orderDirection: z.enum(['asc', 'desc']).optional().default('asc'),
    filters: z.array(filterSchema).optional(),
})

// Build WHERE clause from filters for PostgreSQL
function buildPostgresWhereClause(filters?: z.infer<typeof filterSchema>[]): string {
    if (!filters || filters.length === 0) return ''

    const conditions = filters.map(filter => {
        const column = `"${filter.column}"`
        const value = filter.values[0]

        switch (filter.operator) {
            case '=':
                return `${column} = '${String(value).replace(/'/g, "''")}'`
            case '!=':
                return `${column} != '${String(value).replace(/'/g, "''")}'`
            case '>':
                return `${column} > '${String(value).replace(/'/g, "''")}'`
            case '>=':
                return `${column} >= '${String(value).replace(/'/g, "''")}'`
            case '<':
                return `${column} < '${String(value).replace(/'/g, "''")}'`
            case '<=':
                return `${column} <= '${String(value).replace(/'/g, "''")}'`
            case 'LIKE':
                return `${column} LIKE '${String(value).replace(/'/g, "''")}'`
            case 'NOT LIKE':
                return `${column} NOT LIKE '${String(value).replace(/'/g, "''")}'`
            case 'ILIKE':
                return `${column} ILIKE '${String(value).replace(/'/g, "''")}'`
            case 'NOT ILIKE':
                return `${column} NOT ILIKE '${String(value).replace(/'/g, "''")}'`
            case 'IN':
                const inValues = filter.values.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ')
                return `${column} IN (${inValues})`
            case 'NOT IN':
                const notInValues = filter.values.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ')
                return `${column} NOT IN (${notInValues})`
            case 'IS NULL':
                return `${column} IS NULL`
            case 'IS NOT NULL':
                return `${column} IS NOT NULL`
            case 'BETWEEN':
                return `${column} BETWEEN '${String(filter.values[0]).replace(/'/g, "''")}' AND '${String(filter.values[1]).replace(/'/g, "''")}' `
            default:
                return '1=1'
        }
    })

    return 'WHERE ' + conditions.join(' AND ')
}

/**
 * Get table data with pagination and filtering
 */
export const data = orpc
    .input(getDataSchema)
    .handler(async ({ input }) => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        const offset = (input.page - 1) * input.pageSize
        const limit = input.pageSize

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const fullTableName = `"${input.schema}"."${input.tableName}"`
                    const whereClause = buildPostgresWhereClause(input.filters)

                    // Get total count with filters
                    const countQuery = `SELECT COUNT(*) as count FROM ${fullTableName} ${whereClause}`
                    const countResult = await sql<{ count: string }>`${sql.raw(countQuery)}`.execute(kysely)
                    const total = parseInt(countResult.rows[0]?.count || '0', 10)

                    // Get data with filters
                    const orderClause = input.orderBy
                        ? `ORDER BY "${input.orderBy}" ${input.orderDirection?.toUpperCase() || 'ASC'}`
                        : ''

                    const dataQuery = `SELECT * FROM ${fullTableName} ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`
                    const dataResult = await sql`${sql.raw(dataQuery)}`.execute(kysely)

                    return {
                        rows: dataResult.rows,
                        total,
                        page: input.page,
                        pageSize: input.pageSize,
                        totalPages: Math.ceil(total / input.pageSize),
                    }
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const fullTableName = `\`${database}\`.\`${input.tableName}\``

                    // Get total count
                    const countResult = await sql<{ count: number }>`
                        SELECT COUNT(*) as count FROM ${sql.raw(fullTableName)}
                    `.execute(kysely)
                    const total = countResult.rows[0]?.count || 0

                    // Get data
                    const orderClause = input.orderBy
                        ? sql.raw(`ORDER BY \`${input.orderBy}\` ${input.orderDirection?.toUpperCase() || 'ASC'}`)
                        : sql.raw('')

                    const dataResult = await sql`
                        SELECT * FROM ${sql.raw(fullTableName)}
                        ${orderClause}
                        LIMIT ${limit} OFFSET ${offset}
                    `.execute(kysely)

                    return {
                        rows: dataResult.rows,
                        total,
                        page: input.page,
                        pageSize: input.pageSize,
                        totalPages: Math.ceil(total / input.pageSize),
                    }
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)

                    // Get total count
                    const countResult = await pool.query<{ count: number }>`
                        SELECT COUNT(*) as count FROM [${input.schema}].[${input.tableName}]
                    `
                    const total = countResult.recordset[0]?.count || 0

                    // Get data with pagination
                    const orderBy = input.orderBy || '(SELECT NULL)'
                    const dataResult = await pool.query`
                        SELECT * FROM [${input.schema}].[${input.tableName}]
                        ORDER BY ${sql.raw(orderBy)}
                        OFFSET ${offset} ROWS
                        FETCH NEXT ${limit} ROWS ONLY
                    `

                    return {
                        rows: dataResult.recordset || [],
                        total,
                        page: input.page,
                        pageSize: input.pageSize,
                        totalPages: Math.ceil(total / input.pageSize),
                    }
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)

                    // Get total count
                    const countResult = await client.query({
                        query: `SELECT COUNT(*) as count FROM ${connection.database || 'default'}.${input.tableName}`,
                        format: 'JSONEachRow',
                    })
                    const countRows = await countResult.json<{ count: string }[]>()
                    const total = parseInt(countRows[0]?.count || '0', 10)

                    // Get data
                    const orderClause = input.orderBy
                        ? `ORDER BY ${input.orderBy} ${input.orderDirection?.toUpperCase() || 'ASC'}`
                        : ''

                    const dataResult = await client.query({
                        query: `
                            SELECT * FROM ${connection.database || 'default'}.${input.tableName}
                            ${orderClause}
                            LIMIT ${limit} OFFSET ${offset}
                        `,
                        format: 'JSONEachRow',
                    })
                    const rows = await dataResult.json()

                    return {
                        rows,
                        total,
                        page: input.page,
                        pageSize: input.pageSize,
                        totalPages: Math.ceil(total / input.pageSize),
                    }
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Data fetching not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to fetch data',
            })
        }
    })

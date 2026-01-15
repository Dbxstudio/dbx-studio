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

const updateRowSchema = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    schema: z.string().optional().default('public'),
    primaryKey: z.record(z.any()), // Primary key columns and values
    data: z.record(z.any()), // Columns to update
})

/**
 * Update a row in a table
 */
export const updateRow = orpc
    .input(updateRowSchema)
    .handler(async ({ input }) => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        const pkEntries = Object.entries(input.primaryKey)
        const dataEntries = Object.entries(input.data)

        if (pkEntries.length === 0) {
            throw new ORPCError('BAD_REQUEST', {
                message: 'Primary key is required for updates',
            })
        }

        if (dataEntries.length === 0) {
            throw new ORPCError('BAD_REQUEST', {
                message: 'No data provided for update',
            })
        }

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const fullTableName = `"${input.schema}"."${input.tableName}"`

                    // Helper function to format values for SQL
                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        if (typeof val === 'number') return String(val)
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
                        return String(val)
                    }

                    // Build SET clause with properly escaped values
                    const setClause = dataEntries
                        .map(([col, val]) => `"${col}" = ${formatValue(val)}`)
                        .join(', ')

                    // Build WHERE clause with properly escaped values
                    const whereClause = pkEntries
                        .map(([col, val]) => `"${col}" = ${formatValue(val)}`)
                        .join(' AND ')

                    const result = await sql`
                        UPDATE ${sql.raw(fullTableName)}
                        SET ${sql.raw(setClause)}
                        WHERE ${sql.raw(whereClause)}
                        RETURNING *
                    `.execute(kysely)

                    return {
                        success: true,
                        rowsAffected: result.rows.length,
                        data: result.rows[0],
                    }
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const fullTableName = `\`${database}\`.\`${input.tableName}\``

                    // Helper function to format values for MySQL
                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
                        if (typeof val === 'boolean') return val ? '1' : '0'
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        if (typeof val === 'number') return String(val)
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
                        return String(val)
                    }

                    // Build SET clause
                    const setClause = dataEntries
                        .map(([col, val]) => `\`${col}\` = ${formatValue(val)}`)
                        .join(', ')

                    // Build WHERE clause
                    const whereClause = pkEntries
                        .map(([col, val]) => `\`${col}\` = ${formatValue(val)}`)
                        .join(' AND ')

                    await sql`
                        UPDATE ${sql.raw(fullTableName)}
                        SET ${sql.raw(setClause)}
                        WHERE ${sql.raw(whereClause)}
                    `.execute(kysely)

                    return {
                        success: true,
                        rowsAffected: 1,
                    }
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        return String(val)
                    }

                    // Build SET clause
                    const setClause = dataEntries
                        .map(([col, val]) => `[${col}] = ${formatValue(val)}`)
                        .join(', ')

                    // Build WHERE clause
                    const whereClause = pkEntries
                        .map(([col, val]) => `[${col}] = ${formatValue(val)}`)
                        .join(' AND ')

                    const result = await pool.query`
                        UPDATE [${input.schema}].[${input.tableName}]
                        SET ${sql.raw(setClause)}
                        WHERE ${sql.raw(whereClause)}
                    `

                    return {
                        success: true,
                        rowsAffected: result.rowsAffected[0] || 0,
                    }
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        return String(val)
                    }

                    // Build SET clause
                    const setClause = dataEntries
                        .map(([col, val]) => `${col} = ${formatValue(val)}`)
                        .join(', ')

                    // Build WHERE clause
                    const whereClause = pkEntries
                        .map(([col, val]) => `${col} = ${formatValue(val)}`)
                        .join(' AND ')

                    await client.query({
                        query: `
                            ALTER TABLE ${connection.database || 'default'}.${input.tableName}
                            UPDATE ${setClause}
                            WHERE ${whereClause}
                        `,
                    })

                    return {
                        success: true,
                        rowsAffected: 1,
                    }
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Row update not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to update row',
            })
        }
    })

const insertRowSchema = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    schema: z.string().optional().default('public'),
    data: z.record(z.any()),
})

/**
 * Insert a new row into a table
 */
export const insertRow = orpc
    .input(insertRowSchema)
    .handler(async ({ input }) => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        const dataEntries = Object.entries(input.data)

        if (dataEntries.length === 0) {
            throw new ORPCError('BAD_REQUEST', {
                message: 'No data provided for insert',
            })
        }

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const fullTableName = `"${input.schema}"."${input.tableName}"`

                    // Helper function to format values for SQL
                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        if (typeof val === 'number') return String(val)
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
                        return String(val)
                    }

                    const columns = dataEntries.map(([col]) => `"${col}"`).join(', ')
                    const values = dataEntries.map(([, val]) => formatValue(val)).join(', ')

                    const result = await sql`
                        INSERT INTO ${sql.raw(fullTableName)} (${sql.raw(columns)})
                        VALUES (${sql.raw(values)})
                        RETURNING *
                    `.execute(kysely)

                    return {
                        success: true,
                        data: result.rows[0],
                    }
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const fullTableName = `\`${database}\`.\`${input.tableName}\``

                    // Helper function to format values for MySQL
                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
                        if (typeof val === 'boolean') return val ? '1' : '0'
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        if (typeof val === 'number') return String(val)
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
                        return String(val)
                    }

                    const columns = dataEntries.map(([col]) => `\`${col}\``).join(', ')
                    const values = dataEntries.map(([, val]) => formatValue(val)).join(', ')

                    await sql`
                        INSERT INTO ${sql.raw(fullTableName)} (${sql.raw(columns)})
                        VALUES (${sql.raw(values)})
                    `.execute(kysely)

                    return {
                        success: true,
                    }
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        return String(val)
                    }

                    const columns = dataEntries.map(([col]) => `[${col}]`).join(', ')
                    const values = dataEntries.map(([, val]) => formatValue(val)).join(', ')

                    await pool.query`
                        INSERT INTO [${input.schema}].[${input.tableName}] (${sql.raw(columns)})
                        VALUES (${sql.raw(values)})
                    `

                    return {
                        success: true,
                    }
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        return String(val)
                    }

                    const columns = dataEntries.map(([col]) => col).join(', ')
                    const values = dataEntries.map(([, val]) => formatValue(val)).join(', ')

                    await client.query({
                        query: `
                            INSERT INTO ${connection.database || 'default'}.${input.tableName} (${columns})
                            VALUES (${values})
                        `,
                    })

                    return {
                        success: true,
                    }
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Row insert not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to insert row',
            })
        }
    })

const deleteRowSchema = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    schema: z.string().optional().default('public'),
    primaryKey: z.record(z.any()),
})

/**
 * Delete a row from a table
 */
export const deleteRow = orpc
    .input(deleteRowSchema)
    .handler(async ({ input }) => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        const pkEntries = Object.entries(input.primaryKey)

        if (pkEntries.length === 0) {
            throw new ORPCError('BAD_REQUEST', {
                message: 'Primary key is required for deletion',
            })
        }

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const fullTableName = `"${input.schema}"."${input.tableName}"`

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        if (typeof val === 'number') return String(val)
                        return String(val)
                    }

                    const whereClause = pkEntries
                        .map(([col, val]) => `"${col}" = ${formatValue(val)}`)
                        .join(' AND ')

                    const result = await sql`
                        DELETE FROM ${sql.raw(fullTableName)}
                        WHERE ${sql.raw(whereClause)}
                        RETURNING *
                    `.execute(kysely)

                    return {
                        success: true,
                        rowsAffected: result.rows.length,
                    }
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const fullTableName = `\`${database}\`.\`${input.tableName}\``

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
                        if (typeof val === 'boolean') return val ? '1' : '0'
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        if (typeof val === 'number') return String(val)
                        return String(val)
                    }

                    const whereClause = pkEntries
                        .map(([col, val]) => `\`${col}\` = ${formatValue(val)}`)
                        .join(' AND ')

                    await sql`
                        DELETE FROM ${sql.raw(fullTableName)}
                        WHERE ${sql.raw(whereClause)}
                    `.execute(kysely)

                    return {
                        success: true,
                        rowsAffected: 1,
                    }
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        return String(val)
                    }

                    const whereClause = pkEntries
                        .map(([col, val]) => `[${col}] = ${formatValue(val)}`)
                        .join(' AND ')

                    const result = await pool.query`
                        DELETE FROM [${input.schema}].[${input.tableName}]
                        WHERE ${sql.raw(whereClause)}
                    `

                    return {
                        success: true,
                        rowsAffected: result.rowsAffected[0] || 0,
                    }
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)

                    const formatValue = (val: unknown): string => {
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`
                        if (val instanceof Date) return `'${val.toISOString()}'`
                        return String(val)
                    }

                    const whereClause = pkEntries
                        .map(([col, val]) => `${col} = ${formatValue(val)}`)
                        .join(' AND ')

                    await client.query({
                        query: `
                            ALTER TABLE ${connection.database || 'default'}.${input.tableName}
                            DELETE WHERE ${whereClause}
                        `,
                    })

                    return {
                        success: true,
                        rowsAffected: 1,
                    }
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Row delete not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to delete row',
            })
        }
    })


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

const getColumnsSchema = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    schema: z.string().optional().default('public'),
})

interface ColumnInfo {
    name: string
    type: string
    nullable: boolean
    defaultValue: string | null
    isPrimaryKey: boolean
    isUnique: boolean
    isForeignKey: boolean
    foreignSchema: string | null
    foreignTable: string | null
    foreignColumn: string | null
}

/**
 * Get columns for a specific table with complete constraint information
 */
export const columns = orpc
    .input(getColumnsSchema)
    .handler(async ({ input }): Promise<ColumnInfo[]> => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const result = await sql<{
                        column_name: string
                        data_type: string
                        is_nullable: string
                        column_default: string | null
                        is_primary: boolean
                        is_unique: boolean
                        is_foreign: boolean
                        foreign_schema: string | null
                        foreign_table: string | null
                        foreign_column: string | null
                    }>`
                        SELECT 
                            c.column_name,
                            c.data_type,
                            c.is_nullable,
                            c.column_default,
                            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary,
                            CASE WHEN uq.column_name IS NOT NULL THEN true ELSE false END as is_unique,
                            CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign,
                            fk.foreign_schema,
                            fk.foreign_table,
                            fk.foreign_column
                        FROM information_schema.columns c
                        LEFT JOIN (
                            SELECT kcu.column_name
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage kcu 
                                ON tc.constraint_name = kcu.constraint_name
                                AND tc.table_schema = kcu.table_schema
                            WHERE tc.table_schema = ${input.schema}
                                AND tc.table_name = ${input.tableName}
                                AND tc.constraint_type = 'PRIMARY KEY'
                        ) pk ON c.column_name = pk.column_name
                        LEFT JOIN (
                            SELECT kcu.column_name
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage kcu 
                                ON tc.constraint_name = kcu.constraint_name
                                AND tc.table_schema = kcu.table_schema
                            WHERE tc.table_schema = ${input.schema}
                                AND tc.table_name = ${input.tableName}
                                AND tc.constraint_type = 'UNIQUE'
                        ) uq ON c.column_name = uq.column_name
                        LEFT JOIN (
                            SELECT 
                                kcu.column_name,
                                ccu.table_schema as foreign_schema,
                                ccu.table_name as foreign_table,
                                ccu.column_name as foreign_column
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage kcu 
                                ON tc.constraint_name = kcu.constraint_name
                                AND tc.table_schema = kcu.table_schema
                            JOIN information_schema.constraint_column_usage ccu 
                                ON tc.constraint_name = ccu.constraint_name
                                AND tc.table_schema = ccu.constraint_schema
                            WHERE tc.table_schema = ${input.schema}
                                AND tc.table_name = ${input.tableName}
                                AND tc.constraint_type = 'FOREIGN KEY'
                        ) fk ON c.column_name = fk.column_name
                        WHERE c.table_schema = ${input.schema}
                            AND c.table_name = ${input.tableName}
                        ORDER BY c.ordinal_position
                    `.execute(kysely)

                    return result.rows.map(row => ({
                        name: row.column_name,
                        type: row.data_type,
                        nullable: row.is_nullable === 'YES',
                        defaultValue: row.column_default,
                        isPrimaryKey: row.is_primary,
                        isUnique: row.is_unique,
                        isForeignKey: row.is_foreign,
                        foreignSchema: row.foreign_schema,
                        foreignTable: row.foreign_table,
                        foreignColumn: row.foreign_column,
                    }))
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const result = await sql<{
                        COLUMN_NAME: string
                        DATA_TYPE: string
                        IS_NULLABLE: string
                        COLUMN_DEFAULT: string | null
                        COLUMN_KEY: string
                        REFERENCED_TABLE_SCHEMA: string | null
                        REFERENCED_TABLE_NAME: string | null
                        REFERENCED_COLUMN_NAME: string | null
                    }>`
                        SELECT 
                            c.COLUMN_NAME,
                            c.DATA_TYPE,
                            c.IS_NULLABLE,
                            c.COLUMN_DEFAULT,
                            c.COLUMN_KEY,
                            kcu.REFERENCED_TABLE_SCHEMA,
                            kcu.REFERENCED_TABLE_NAME,
                            kcu.REFERENCED_COLUMN_NAME
                        FROM information_schema.COLUMNS c
                        LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
                            ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                            AND c.TABLE_NAME = kcu.TABLE_NAME
                            AND c.COLUMN_NAME = kcu.COLUMN_NAME
                            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
                        WHERE c.TABLE_SCHEMA = ${database}
                            AND c.TABLE_NAME = ${input.tableName}
                        ORDER BY c.ORDINAL_POSITION
                    `.execute(kysely)

                    return result.rows.map(row => ({
                        name: row.COLUMN_NAME,
                        type: row.DATA_TYPE,
                        nullable: row.IS_NULLABLE === 'YES',
                        defaultValue: row.COLUMN_DEFAULT,
                        isPrimaryKey: row.COLUMN_KEY === 'PRI',
                        isUnique: row.COLUMN_KEY === 'UNI',
                        isForeignKey: row.COLUMN_KEY === 'MUL' && !!row.REFERENCED_TABLE_NAME,
                        foreignSchema: row.REFERENCED_TABLE_SCHEMA,
                        foreignTable: row.REFERENCED_TABLE_NAME,
                        foreignColumn: row.REFERENCED_COLUMN_NAME,
                    }))
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)
                    const result = await pool.query<{
                        COLUMN_NAME: string
                        DATA_TYPE: string
                        IS_NULLABLE: string
                        COLUMN_DEFAULT: string | null
                        IS_PRIMARY: boolean
                        FOREIGN_SCHEMA: string | null
                        FOREIGN_TABLE: string | null
                        FOREIGN_COLUMN: string | null
                    }>`
                        SELECT 
                            c.COLUMN_NAME,
                            c.DATA_TYPE,
                            c.IS_NULLABLE,
                            c.COLUMN_DEFAULT,
                            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY,
                            fk.FOREIGN_SCHEMA,
                            fk.FOREIGN_TABLE,
                            fk.FOREIGN_COLUMN
                        FROM INFORMATION_SCHEMA.COLUMNS c
                        LEFT JOIN (
                            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                            WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_NAME), 'IsPrimaryKey') = 1
                                AND TABLE_NAME = @table
                        ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                        LEFT JOIN (
                            SELECT 
                                kcu.COLUMN_NAME,
                                kcu2.TABLE_SCHEMA as FOREIGN_SCHEMA,
                                kcu2.TABLE_NAME as FOREIGN_TABLE,
                                kcu2.COLUMN_NAME as FOREIGN_COLUMN
                            FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                                ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu2
                                ON rc.UNIQUE_CONSTRAINT_NAME = kcu2.CONSTRAINT_NAME
                            WHERE kcu.TABLE_NAME = @table AND kcu.TABLE_SCHEMA = @schema
                        ) fk ON c.COLUMN_NAME = fk.COLUMN_NAME
                        WHERE c.TABLE_NAME = @table AND c.TABLE_SCHEMA = @schema
                        ORDER BY c.ORDINAL_POSITION
                    `

                    return (result.recordset || []).map(row => ({
                        name: row.COLUMN_NAME,
                        type: row.DATA_TYPE,
                        nullable: row.IS_NULLABLE === 'YES',
                        defaultValue: row.COLUMN_DEFAULT,
                        isPrimaryKey: row.IS_PRIMARY,
                        isUnique: false,
                        isForeignKey: !!row.FOREIGN_TABLE,
                        foreignSchema: row.FOREIGN_SCHEMA,
                        foreignTable: row.FOREIGN_TABLE,
                        foreignColumn: row.FOREIGN_COLUMN,
                    }))
                }

                case 'clickhouse': {
                    // ClickHouse doesn't support foreign keys, so we just return null for FK fields
                    const client = createClickHouseConnection(connection)
                    const result = await client.query({
                        query: `
                            SELECT name, type, default_expression, is_in_primary_key
                            FROM system.columns
                            WHERE database = {database:String} AND table = {table:String}
                            ORDER BY position
                        `,
                        query_params: {
                            database: connection.database || 'default',
                            table: input.tableName,
                        },
                        format: 'JSONEachRow',
                    })
                    const rows = await result.json<{
                        name: string
                        type: string
                        default_expression: string
                        is_in_primary_key: number
                    }[]>()

                    return rows.map(row => ({
                        name: row.name,
                        type: row.type,
                        nullable: row.type.includes('Nullable'),
                        defaultValue: row.default_expression || null,
                        isPrimaryKey: row.is_in_primary_key === 1,
                        isUnique: false,
                        isForeignKey: false,
                        foreignSchema: null,
                        foreignTable: null,
                        foreignColumn: null,
                    }))
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Column fetching not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to get columns',
            })
        }
    })

/**
 * AI Backend Database Initialization
 * SQLite database with Sequelize for AI functionality
 * Based on SUMR SQL Client architecture
 */

import { Sequelize } from 'sequelize'
import path from 'path'
import fs from 'fs'
import consola from 'consola'
import { v4 as uuidv4 } from 'uuid'

// Import AI models
import {
    DbType,
    ConnectionStatus,
    ActiveConnection,
    Database,
    Schema,
    SchemaTable,
    ColumnDesc,
    Session,
    Conversation,
    LongTermMemory
} from './ai-models'

// Get database path
function getDatabasePath(): string {
    // Store in project data directory
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
    }
    return path.join(dataDir, 'ai_database.db')
}

class AIDatabase {
    sequelize: Sequelize | null = null
    models: Record<string, any> = {}
    initialized = false

    // Initialize database connection
    async initialize() {
        try {
            const dbPath = getDatabasePath()
            consola.info(`AI Database path: ${dbPath}`)

            // Initialize Sequelize with SQLite
            this.sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: dbPath,
                logging: false,
                define: {
                    timestamps: false,
                    underscored: false,
                    freezeTableName: true
                }
            })

            // Apply SQLite pragmas
            await this.sequelize.query('PRAGMA foreign_keys=ON')
            await this.sequelize.query('PRAGMA journal_mode=WAL')

            // Define models
            this.models.DbType = this.sequelize.define('DbType', DbType.attributes, {
                tableName: DbType.tableName
            })

            this.models.ConnectionStatus = this.sequelize.define('ConnectionStatus', ConnectionStatus.attributes, {
                tableName: ConnectionStatus.tableName
            })

            this.models.ActiveConnection = this.sequelize.define('ActiveConnection', ActiveConnection.attributes, {
                tableName: ActiveConnection.tableName
            })

            this.models.Database = this.sequelize.define('Database', Database.attributes, {
                tableName: Database.tableName
            })

            this.models.Schema = this.sequelize.define('Schema', Schema.attributes, {
                tableName: Schema.tableName
            })

            this.models.SchemaTable = this.sequelize.define('SchemaTable', SchemaTable.attributes, {
                tableName: SchemaTable.tableName
            })

            this.models.ColumnDesc = this.sequelize.define('ColumnDesc', ColumnDesc.attributes, {
                tableName: ColumnDesc.tableName
            })

            this.models.Session = this.sequelize.define('Session', Session.attributes, {
                tableName: Session.tableName
            })

            this.models.Conversation = this.sequelize.define('Conversation', Conversation.attributes, {
                tableName: Conversation.tableName
            })

            this.models.LongTermMemory = this.sequelize.define('LongTermMemory', LongTermMemory.attributes, {
                tableName: LongTermMemory.tableName
            })

            // Define associations
            this.setupAssociations()

            // Test connection
            await this.sequelize.authenticate()
            consola.success('AI Database connection established')

            // Sync database
            await this.syncDatabase()

            // Initialize default data
            await this.initializeDefaultData()

            this.initialized = true
            consola.success('AI Database initialized successfully')

        } catch (error: any) {
            consola.error(`AI Database initialization failed: ${error.message}`)
            throw error
        }
    }

    // Setup model associations
    setupAssociations() {
        // DbType has many ActiveConnections
        this.models.DbType.hasMany(this.models.ActiveConnection, {
            foreignKey: 'db_type_id',
            as: 'activeConnections'
        })

        // ConnectionStatus has many ActiveConnections
        this.models.ConnectionStatus.hasMany(this.models.ActiveConnection, {
            foreignKey: 'status_id',
            as: 'activeConnections'
        })

        // ActiveConnection belongs to DbType and ConnectionStatus
        this.models.ActiveConnection.belongsTo(this.models.DbType, {
            foreignKey: 'db_type_id',
            as: 'dbType'
        })

        this.models.ActiveConnection.belongsTo(this.models.ConnectionStatus, {
            foreignKey: 'status_id',
            as: 'status'
        })

        // ActiveConnection has many Databases
        this.models.ActiveConnection.hasMany(this.models.Database, {
            foreignKey: 'active_connection_id',
            as: 'databases'
        })

        // Database belongs to ActiveConnection
        this.models.Database.belongsTo(this.models.ActiveConnection, {
            foreignKey: 'active_connection_id',
            as: 'activeConnection'
        })

        // Database has many Schemas
        this.models.Database.hasMany(this.models.Schema, {
            foreignKey: 'database_id',
            as: 'schemas'
        })

        // Schema belongs to Database
        this.models.Schema.belongsTo(this.models.Database, {
            foreignKey: 'database_id',
            as: 'database'
        })

        // Schema has many SchemaTables
        this.models.Schema.hasMany(this.models.SchemaTable, {
            foreignKey: 'schema_id',
            as: 'tables'
        })

        // SchemaTable belongs to Database and Schema
        this.models.SchemaTable.belongsTo(this.models.Database, {
            foreignKey: 'database_id',
            as: 'database'
        })

        this.models.SchemaTable.belongsTo(this.models.Schema, {
            foreignKey: 'schema_id',
            as: 'schema'
        })

        // SchemaTable has many ColumnDescriptions
        this.models.SchemaTable.hasMany(this.models.ColumnDesc, {
            foreignKey: 'table_id',
            as: 'columns'
        })

        // ColumnDesc belongs to SchemaTable
        this.models.ColumnDesc.belongsTo(this.models.SchemaTable, {
            foreignKey: 'table_id',
            as: 'schemaTable'
        })

        // Session belongs to ActiveConnection
        this.models.Session.belongsTo(this.models.ActiveConnection, {
            foreignKey: 'active_connection_id',
            as: 'activeConnection'
        })

        // Session has many Conversations
        this.models.Session.hasMany(this.models.Conversation, {
            foreignKey: 'session_id',
            as: 'conversations'
        })

        // Conversation belongs to Session
        this.models.Conversation.belongsTo(this.models.Session, {
            foreignKey: 'session_id',
            as: 'session'
        })

        // Conversation belongs to Database and Schema (optional)
        this.models.Conversation.belongsTo(this.models.Database, {
            foreignKey: 'database_id',
            as: 'database'
        })

        this.models.Conversation.belongsTo(this.models.Schema, {
            foreignKey: 'schema_id',
            as: 'schema'
        })

        // Conversation has many LongTermMemories
        this.models.Conversation.hasMany(this.models.LongTermMemory, {
            foreignKey: 'conversation_id',
            as: 'memories'
        })

        // LongTermMemory belongs to Conversation
        this.models.LongTermMemory.belongsTo(this.models.Conversation, {
            foreignKey: 'conversation_id',
            as: 'conversation'
        })
    }

    // Sync database (create tables)
    async syncDatabase() {
        try {
            await this.sequelize!.sync({ force: false })
            consola.success('AI Database tables synced')
        } catch (error: any) {
            consola.error(`AI Database sync failed: ${error.message}`)
            throw error
        }
    }

    // Initialize default data
    async initializeDefaultData() {
        try {
            // Insert default database types
            const dbTypes = [
                'postgresql', 'oracle', 'mysql', 'mariadb', 'postgres',
                'redshift', 'mssql', 'sqlite', 'ibm db2', 'apache spark',
                'apache impala', 'data.world', 'athena', 'csv', 'bigquery',
                'clickhouse', 'snowflake'
            ]

            for (const name of dbTypes) {
                await this.models.DbType.findOrCreate({
                    where: { name },
                    defaults: { name, created_at: new Date(), updated_at: new Date() }
                })
            }

            // Insert required connection statuses
            const statuses = [
                { status_id: 1000, status: 'new' },
                { status_id: 1100, status: 'pending' },
                { status_id: 1300, status: 'failed' },
                { status_id: 1400, status: 'completed' }
            ]

            for (const status of statuses) {
                await this.models.ConnectionStatus.findOrCreate({
                    where: { status_id: status.status_id },
                    defaults: {
                        status_id: status.status_id,
                        status: status.status,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                })
            }

            consola.success('AI Database default data initialized')
        } catch (error: any) {
            consola.error(`Default data initialization failed: ${error.message}`)
        }
    }

    // ============ Session Management ============

    /**
     * Create or get existing session for a connection
     */
    async createSession(activeConnectionId: number, sessionName?: string): Promise<string> {
        try {
            // Check if session exists
            const existingSession = await this.models.Session.findOne({
                where: { active_connection_id: activeConnectionId },
                order: [['last_activity', 'DESC']]
            })

            if (existingSession) {
                // Update last activity
                await existingSession.update({ last_activity: new Date() })
                consola.info(`Reusing session: ${existingSession.session_id}`)
                return existingSession.session_id
            }

            // Create new session
            const sessionId = uuidv4()
            const name = sessionName || `Session ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

            await this.models.Session.create({
                session_id: sessionId,
                active_connection_id: activeConnectionId,
                session_name: name,
                created_at: new Date(),
                last_activity: new Date()
            })

            consola.info(`Created new session: ${sessionId}`)
            return sessionId
        } catch (error: any) {
            consola.error(`Session creation failed: ${error.message}`)
            throw error
        }
    }

    /**
     * Save conversation messages
     */
    async saveConversation(
        sessionId: string,
        messages: any[],
        databaseId?: number,
        schemaId?: number
    ): Promise<string> {
        try {
            const conversationId = uuidv4()

            await this.models.Conversation.create({
                conversation_id: conversationId,
                session_id: sessionId,
                database_id: databaseId || null,
                schema_id: schemaId || null,
                messages: JSON.stringify(messages),
                timestamp: new Date()
            })

            // Update session activity
            await this.models.Session.update(
                { last_activity: new Date() },
                { where: { session_id: sessionId } }
            )

            consola.info(`Saved conversation: ${conversationId}`)
            return conversationId
        } catch (error: any) {
            consola.error(`Conversation save failed: ${error.message}`)
            throw error
        }
    }

    /**
     * Load conversation history
     */
    async loadConversations(
        sessionId: string,
        databaseId?: number,
        schemaId?: number,
        limit: number = 100
    ): Promise<any[]> {
        try {
            const where: any = { session_id: sessionId }

            if (databaseId !== undefined && schemaId !== undefined) {
                where.database_id = databaseId
                where.schema_id = schemaId
            } else if (databaseId !== undefined) {
                where.database_id = databaseId
            }

            const conversations = await this.models.Conversation.findAll({
                where,
                order: [['timestamp', 'DESC']],
                limit
            })

            const messages: any[] = []
            for (const conv of conversations.reverse()) {
                const parsed = JSON.parse(conv.messages || '[]')
                messages.push(...parsed)
            }

            return messages
        } catch (error: any) {
            consola.error(`Load conversations failed: ${error.message}`)
            return []
        }
    }

    // Get model by name
    getModel(modelName: string) {
        if (!this.initialized) {
            throw new Error('Database not initialized')
        }
        return this.models[modelName]
    }

    // Get Sequelize instance
    getSequelize() {
        if (!this.initialized) {
            throw new Error('Database not initialized')
        }
        return this.sequelize!
    }

    // Close database connection
    async close() {
        if (this.sequelize) {
            await this.sequelize.close()
            consola.info('AI Database connection closed')
        }
    }
}

// Create singleton instance
const aiDatabase = new AIDatabase()

export default aiDatabase
export { AIDatabase }

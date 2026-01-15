/**
 * AI Backend Database Models
 * Sequelize models for AI functionality (sessions, conversations, memory, semantic metadata)
 * Based on SUMR SQL Client architecture
 */

import { DataTypes } from 'sequelize'

// Database Type model
export const DbType = {
    tableName: 'db_type',
    attributes: {
        db_type_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Connection Status model
export const ConnectionStatus = {
    tableName: 'connection_status',
    attributes: {
        status_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Active Connection model
export const ActiveConnection = {
    tableName: 'active_connection',
    attributes: {
        active_connection_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        connection_string: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        db_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'db_type',
                key: 'db_type_id'
            }
        },
        is_ssl: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        status_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'connection_status',
                key: 'status_id'
            }
        },
        user_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        database: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        external_connection_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Database model
export const Database = {
    tableName: 'database',
    attributes: {
        database_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        active_connection_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'active_connection',
                key: 'active_connection_id'
            }
        },
        database_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        schema_status_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1000
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Schema model
export const Schema = {
    tableName: 'schema',
    attributes: {
        schema_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        database_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'database',
                key: 'database_id'
            }
        },
        schema_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Schema Table model
export const SchemaTable = {
    tableName: 'schema_table',
    attributes: {
        schema_table_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        database_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'database',
                key: 'database_id'
            }
        },
        schema_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'schema',
                key: 'schema_id'
            }
        },
        table_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        ai_description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Column Description model
export const ColumnDesc = {
    tableName: 'column_desc',
    attributes: {
        column_desc_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        table_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'schema_table',
                key: 'schema_table_id'
            }
        },
        column_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        column_type: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        ai_description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Session model (for chat sessions)
export const Session = {
    tableName: 'sessions',
    attributes: {
        session_id: {
            type: DataTypes.STRING(255),
            primaryKey: true
        },
        active_connection_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'active_connection',
                key: 'active_connection_id'
            }
        },
        session_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        last_activity: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Conversation model (chat history)
export const Conversation = {
    tableName: 'conversations',
    attributes: {
        conversation_id: {
            type: DataTypes.STRING(255),
            primaryKey: true
        },
        session_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            references: {
                model: 'sessions',
                key: 'session_id'
            }
        },
        database_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'database',
                key: 'database_id'
            }
        },
        schema_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'schema',
                key: 'schema_id'
            }
        },
        messages: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

// Long Term Memory model
export const LongTermMemory = {
    tableName: 'long_term_memories',
    attributes: {
        memory_id: {
            type: DataTypes.STRING(255),
            primaryKey: true
        },
        conversation_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            references: {
                model: 'conversations',
                key: 'conversation_id'
            }
        },
        database_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'database',
                key: 'database_id'
            }
        },
        schema_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'schema',
                key: 'schema_id'
            }
        },
        scope_level: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'global'
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        embedding: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        memory_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'extracted'
        },
        importance_score: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 1.0
        },
        access_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        last_accessed: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }
}

import { FaTimes, FaDatabase } from 'react-icons/fa'
import { BiLogoPostgresql } from 'react-icons/bi'
import { GrMysql } from 'react-icons/gr'
import { SiSnowflake, SiSqlite, SiMariadb } from 'react-icons/si'
import './connection-modal.css'

export type ConnectionType = 'postgresql' | 'mysql' | 'mssql' | 'sqlite' | 'snowflake'

interface ConnectionTypeConfig {
    type: ConnectionType
    name: string
    icon: React.ReactNode
    description: string
    comingSoon?: boolean
}

const connectionTypes: ConnectionTypeConfig[] = [
    {
        type: 'postgresql',
        name: 'PostgreSQL',
        icon: <BiLogoPostgresql size={40} className="connection-type-icon postgres" />,
        description: 'Connect to PostgreSQL database'
    },
    {
        type: 'snowflake',
        name: 'Snowflake',
        icon: <SiSnowflake size={40} className="connection-type-icon snowflake" />,
        description: 'Connect to Snowflake Data Cloud',
        comingSoon: true
    },
    {
        type: 'mysql',
        name: 'MySQL',
        icon: <GrMysql size={40} className="connection-type-icon mysql" />,
        description: 'Connect to MySQL database',
        comingSoon: true
    },
    {
        type: 'sqlite',
        name: 'SQLite',
        icon: <SiSqlite size={40} className="connection-type-icon sqlite" />,
        description: 'Connect to SQLite database',
        comingSoon: true
    },
    {
        type: 'mssql',
        name: 'SQL Server',
        icon: <FaDatabase size={40} className="connection-type-icon mssql" />,
        description: 'Connect to Microsoft SQL Server',
        comingSoon: true
    },
]

interface ConnectionTypeSelectorProps {
    isOpen: boolean
    onClose: () => void
    onSelectType: (type: ConnectionType) => void
}

export function ConnectionTypeSelector({ isOpen, onClose, onSelectType }: ConnectionTypeSelectorProps) {
    if (!isOpen) return null

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && e.button === 0) {
            onClose()
        }
    }

    const handleModalContentClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <div
            className="connection-modal-overlay"
            onMouseDown={handleOverlayClick}
        >
            <div
                className="connection-type-selector dark-theme"
                onMouseDown={handleModalContentClick}
            >
                {/* Header */}
                <div className="modal-header">
                    <h2>Select Database Type</h2>
                    <div
                        className="close-btn"
                        onClick={onClose}
                        role="button"
                        tabIndex={0}
                        aria-label="close"
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose() }}
                    >
                        <FaTimes size={16} />
                    </div>
                </div>

                {/* Connection Type Grid */}
                <div className="connection-type-grid">
                    {connectionTypes.map((connType) => (
                        <div
                            key={connType.type}
                            className={`connection-type-card ${connType.comingSoon ? 'coming-soon' : ''}`}
                            onClick={() => !connType.comingSoon && onSelectType(connType.type)}
                        >
                            <div className="connection-type-icon-wrapper">
                                {connType.icon}
                            </div>
                            <div className="connection-type-name">{connType.name}</div>
                            <div className="connection-type-desc">{connType.description}</div>
                            {connType.comingSoon && (
                                <div className="coming-soon-badge">Coming Soon</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

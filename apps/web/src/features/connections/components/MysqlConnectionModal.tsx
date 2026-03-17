import { useEffect, useRef, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { GrMysql } from 'react-icons/gr'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useCreateConnection, useUpdateConnection, useTestConnection, type CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface MysqlConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

interface MysqlFamilyConnectionModalProps extends MysqlConnectionModalProps {
    variant?: 'mysql' | 'mariadb'
}

function getStoredUserId() {
    try {
        const raw = localStorage.getItem('dbx_user_info')
        if (!raw) {
            return undefined
        }

        const parsed = JSON.parse(raw)
        if (parsed?.user_id === undefined || parsed?.user_id === null) {
            return undefined
        }

        return String(parsed.user_id)
    } catch {
        return undefined
    }
}

function getResolvedUserId(userId?: string, existingUserId?: string) {
    return existingUserId || userId || getStoredUserId()
}

function createDefaultFormData(variant: 'mysql' | 'mariadb', userId?: string): CreateConnectionInput {
    return {
        name: '',
        type: 'mysql',
        userId: getResolvedUserId(userId),
        host: 'localhost',
        port: 3306,
        database: '',
        username: '',
        password: '',
        ssl: false,
        showAllDatabases: true,
        requireServerRegistration: true,
        serverDriver: variant,
    }
}

export function MysqlFamilyConnectionModal({
    isOpen,
    onClose,
    onBack,
    onSaveSuccess,
    userId,
    isEditing = false,
    existingConnection,
    variant = 'mysql',
}: MysqlFamilyConnectionModalProps) {
    const [showAllDatabases, setShowAllDatabases] = useState(true)
    const [formData, setFormData] = useState<CreateConnectionInput>(() => createDefaultFormData(variant, userId))

    const firstMissingRef = useRef<HTMLInputElement>(null)

    const createConnection = useCreateConnection()
    const updateConnection = useUpdateConnection()
    const testConnection = useTestConnection()

    useEffect(() => {
        if (!isOpen) {
            return
        }

        if (isEditing && existingConnection) {
            setShowAllDatabases(existingConnection.showAllDatabases ?? true)
            setFormData({
                name: existingConnection.name || '',
                type: 'mysql',
                userId: getResolvedUserId(userId, existingConnection.userId),
                host: existingConnection.host || 'localhost',
                port: existingConnection.port || 3306,
                database: existingConnection.database || '',
                username: existingConnection.username || '',
                password: existingConnection.password || '',
                ssl: existingConnection.ssl ?? false,
                showAllDatabases: existingConnection.showAllDatabases ?? true,
                requireServerRegistration: true,
                serverDriver: variant,
            })
        } else {
            setShowAllDatabases(true)
            setFormData(createDefaultFormData(variant, userId))
        }

        createConnection.reset()
        updateConnection.reset()
        testConnection.reset()
    }, [isOpen, userId, isEditing, existingConnection, variant])

    if (!isOpen) {
        return null
    }

    const title = variant === 'mariadb' ? 'MariaDB' : 'MySQL'

    const handleChange = (field: keyof CreateConnectionInput, value: string | number | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleTestConnection = () => {
        testConnection.mutate({
            ...formData,
            userId: getResolvedUserId(userId, formData.userId),
        })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const finalFormData: CreateConnectionInput = {
            ...formData,
            name: formData.name || `${formData.host}:${formData.database || title}`,
            userId: getResolvedUserId(userId, formData.userId),
            showAllDatabases,
            requireServerRegistration: true,
            serverDriver: variant,
        }

        if (isEditing && existingConnection?.id) {
            updateConnection.mutate(
                { id: existingConnection.id, ...finalFormData },
                {
                    onSuccess: () => {
                        onSaveSuccess?.(existingConnection.id!)
                        window.setTimeout(() => {
                            onClose()
                        }, 1200)
                    },
                },
            )
            return
        }

        createConnection.mutate(finalFormData, {
            onSuccess: (data) => {
                if (data?.id) {
                    onSaveSuccess?.(data.id)
                }

                window.setTimeout(() => {
                    onClose()
                }, 1200)
            },
        })
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const requiredFields = ['host', 'username', 'database'] as const
    const missingFields = requiredFields.filter(field => {
        const value = formData[field]
        return !value || (typeof value === 'string' && value.trim() === '')
    })
    const isValid = missingFields.length === 0

    const isTestLoading = testConnection.isPending
    const isTestSuccess = testConnection.isSuccess
    const isTestError = testConnection.isError
    const isSaveLoading = isEditing ? updateConnection.isPending : createConnection.isPending
    const isSaveSuccess = isEditing ? updateConnection.isSuccess : createConnection.isSuccess
    const isSaveError = isEditing ? updateConnection.isError : createConnection.isError
    const saveError = isEditing ? updateConnection.error : createConnection.error
    const hasSuccessfulConnection = isTestSuccess || isSaveSuccess

    return (
        <div className="connection-modal-overlay" onMouseDown={handleOverlayClick}>
            <div className="connection-modal dark-theme">
                <div className="modal-header">
                    <div className="modal-header-title">
                        <GrMysql size={24} className="mysql" />
                        <h2>{isEditing ? `Edit ${title} Connection` : `New ${title} Connection`}</h2>
                    </div>
                    <div className="close-btn" onClick={onClose} role="button" tabIndex={0} aria-label="close">
                        <FaTimes size={16} />
                    </div>
                </div>

                {(isSaveError || isTestError) && (
                    <div className="message-box error">
                        <X size={14} />
                        <span>{saveError?.message || testConnection.error?.message || 'Connection failed. Please check your credentials and try again.'}</span>
                    </div>
                )}

                {isSaveSuccess && (
                    <div className="message-box success">
                        <Check size={14} />
                        <span>{isEditing ? 'Changes saved.' : 'Connection saved. This modal will close automatically.'}</span>
                    </div>
                )}

                <form className="connection-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Host <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.host || ''}
                                onChange={e => handleChange('host', e.target.value)}
                                placeholder="localhost or db.example.com"
                                ref={missingFields.includes('host') ? firstMissingRef : null}
                            />
                        </div>

                        <div className="form-group">
                            <label>Port</label>
                            <div className="hint">Default: 3306</div>
                            <input
                                type="number"
                                value={formData.port || 3306}
                                onChange={e => handleChange('port', parseInt(e.target.value, 10) || 3306)}
                                placeholder="3306"
                            />
                        </div>

                        <div className="form-group">
                            <label>Username <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.username || ''}
                                onChange={e => handleChange('username', e.target.value)}
                                placeholder={variant === 'mariadb' ? 'root' : 'mysql'}
                                ref={missingFields.includes('username') ? firstMissingRef : null}
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={formData.password || ''}
                                onChange={e => handleChange('password', e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="form-group">
                            <label>Database <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.database || ''}
                                onChange={e => handleChange('database', e.target.value)}
                                placeholder={variant === 'mariadb' ? 'mariadb' : 'mysql'}
                                ref={missingFields.includes('database') ? firstMissingRef : null}
                            />
                            <div className="hint">Used as the default database when the connection opens.</div>
                        </div>

                        <div className="form-group">
                            <label>Connection Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder={`My ${title}`}
                            />
                            <div className="hint">Optional display name</div>
                        </div>

                        <div className="form-group toggle-group">
                            <label className="toggle-label">
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(formData.ssl)}
                                        onChange={e => handleChange('ssl', e.target.checked)}
                                    />
                                    <span className="slider" />
                                </label>
                                <span>Use SSL Connection</span>
                            </label>
                        </div>

                        <div className="form-group toggle-group">
                            <label className="toggle-label">
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={showAllDatabases}
                                        onChange={e => setShowAllDatabases(e.target.checked)}
                                    />
                                    <span className="slider" />
                                </label>
                                <span>Show all databases</span>
                            </label>
                        </div>
                    </div>

                    {hasSuccessfulConnection && !isSaveError && (
                        <div className="test-success">
                            <Check size={14} />
                            <span>{isSaveSuccess ? 'Connection saved successfully.' : 'Test connection successful. You can now save this connection.'}</span>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onBack}
                        >
                            <ArrowLeft size={14} />
                            Back
                        </button>
                        <div className="action-buttons">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handleTestConnection}
                                disabled={!isValid || isTestLoading || isSaveLoading}
                            >
                                {isTestLoading && <Loader2 size={14} className="spin" />}
                                {isTestLoading ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!isValid || isSaveLoading}
                            >
                                {isSaveLoading && <Loader2 size={14} className="spin" />}
                                {isSaveLoading
                                    ? (isEditing ? 'Saving...' : 'Connecting...')
                                    : isSaveSuccess
                                        ? (isEditing ? 'Saved' : 'Connected')
                                        : (isEditing ? 'Save Changes' : 'Save Connection')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

export function MysqlConnectionModal(props: MysqlConnectionModalProps) {
    return <MysqlFamilyConnectionModal {...props} variant="mysql" />
}
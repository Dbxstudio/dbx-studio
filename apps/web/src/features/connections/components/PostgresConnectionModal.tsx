import { useState, useEffect, useRef } from 'react'
import { FaTimes } from 'react-icons/fa'
import { BiLogoPostgresql } from 'react-icons/bi'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useCreateConnection, useUpdateConnection, useTestConnection, type CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface PostgresConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

export function PostgresConnectionModal({
    isOpen,
    onClose,
    onBack,
    onSaveSuccess,
    userId,
    isEditing = false,
    existingConnection
}: PostgresConnectionModalProps) {
    // Form state
    const [formData, setFormData] = useState<CreateConnectionInput>({
        name: '',
        type: 'postgresql',
        userId: userId ? String(userId) : undefined,
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        username: '',
        password: '',
        ssl: false,
    })

    const firstMissingRef = useRef<HTMLInputElement>(null)

    // API mutations
    const createConnection = useCreateConnection()
    const updateConnection = useUpdateConnection()
    const testConnection = useTestConnection()

    // Reset on open or when existing connection changes
    useEffect(() => {
        if (isOpen) {
            if (isEditing && existingConnection) {
                setFormData({
                    name: existingConnection.name || '',
                    type: 'postgresql',
                    userId: existingConnection.userId || (userId ? String(userId) : undefined),
                    host: existingConnection.host || 'localhost',
                    port: existingConnection.port || 5432,
                    database: existingConnection.database || 'postgres',
                    username: existingConnection.username || '',
                    password: existingConnection.password || '',
                    ssl: existingConnection.ssl || false,
                })
            } else {
                setFormData({
                    name: '',
                    type: 'postgresql',
                    userId: userId ? String(userId) : undefined,
                    host: 'localhost',
                    port: 5432,
                    database: 'postgres',
                    username: '',
                    password: '',
                    ssl: false,
                })
            }
            createConnection.reset()
            updateConnection.reset()
            testConnection.reset()
        }
    }, [isOpen, userId, isEditing, existingConnection])

    if (!isOpen) return null

    const handleChange = (field: keyof CreateConnectionInput, value: string | number | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleTestConnection = async () => {
        testConnection.mutate(formData)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Ensure we have a connection name - use host:database if not provided
        const finalFormData = {
            ...formData,
            name: formData.name || `${formData.host}:${formData.database}`
        }

        if (isEditing && existingConnection?.id) {
            // Update existing connection
            updateConnection.mutate(
                { id: existingConnection.id, ...finalFormData },
                {
                    onSuccess: () => {
                        // Trigger schema refresh for this connection
                        if (existingConnection?.id) {
                            onSaveSuccess?.(existingConnection.id)
                        }
                        setTimeout(() => {
                            onClose()
                        }, 1500)
                    },
                }
            )
        } else {
            // Create new connection
            createConnection.mutate(finalFormData, {
                onSuccess: (data) => {
                    // Trigger schema refresh for the new connection
                    if (data?.id) {
                        onSaveSuccess?.(data.id)
                    }
                    setTimeout(() => {
                        onClose()
                    }, 1500)
                },
            })
        }
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    // Validation
    const requiredFields = ['host', 'username', 'database']
    const missingFields = requiredFields.filter(f => {
        const value = formData[f as keyof CreateConnectionInput]
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

    return (
        <div className="connection-modal-overlay" onMouseDown={handleOverlayClick}>
            <div className="connection-modal dark-theme">
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-title">
                        <BiLogoPostgresql size={24} className="postgres" />
                        <h2>{isEditing ? 'Edit PostgreSQL Connection' : 'New PostgreSQL Connection'}</h2>
                    </div>
                    <div className="close-btn" onClick={onClose} role="button" tabIndex={0} aria-label="close">
                        <FaTimes size={16} />
                    </div>
                </div>

                {/* Error Message */}
                {(isSaveError || isTestError) && (
                    <div className="message-box error">
                        <X size={14} />
                        <span>{saveError?.message || testConnection.error?.message || 'Connection failed. Please check your credentials and try again.'}</span>
                    </div>
                )}

                {/* Success Message */}
                {isSaveSuccess && (
                    <div className="message-box success">
                        <Check size={14} />
                        <span>{isEditing ? 'Changes saved.' : 'Connection saved. This modal will close automatically.'}</span>
                    </div>
                )}

                {/* Form */}
                <form className="connection-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        {/* Host */}
                        <div className="form-group">
                            <label>Host <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.host}
                                onChange={e => handleChange('host', e.target.value)}
                                placeholder="localhost or 192.168.1.100"
                                ref={missingFields.includes('host') ? firstMissingRef : null}
                            />
                        </div>

                        {/* Port */}
                        <div className="form-group">
                            <label>Port</label>
                            <div className="hint">Default: 5432</div>
                            <input
                                type="number"
                                value={formData.port}
                                onChange={e => handleChange('port', parseInt(e.target.value) || 5432)}
                                placeholder="5432"
                            />
                        </div>

                        {/* Username */}
                        <div className="form-group">
                            <label>Username <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={e => handleChange('username', e.target.value)}
                                placeholder="postgres"
                                ref={missingFields.includes('username') ? firstMissingRef : null}
                            />
                        </div>

                        {/* Password */}
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={e => handleChange('password', e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Database */}
                        <div className="form-group">
                            <label>Database <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.database}
                                onChange={e => handleChange('database', e.target.value)}
                                placeholder="postgres"
                                ref={missingFields.includes('database') ? firstMissingRef : null}
                            />
                            <div className="hint">Database used for connection and test</div>
                        </div>

                        {/* Connection Name */}
                        <div className="form-group">
                            <label>Connection Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="My PostgreSQL"
                            />
                            <div className="hint">Optional display name</div>
                        </div>

                        {/* SSL Toggle */}
                        <div className="form-group toggle-group">
                            <label className="toggle-label">
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={formData.ssl}
                                        onChange={e => handleChange('ssl', e.target.checked)}
                                    />
                                    <span className="slider" />
                                </label>
                                <span>Use SSL Connection</span>
                            </label>
                        </div>
                    </div>

                    {/* Test Success */}
                    {isTestSuccess && (
                        <div className="test-success">
                            <Check size={14} />
                            <span>Test connection successful! You can now save this connection.</span>
                        </div>
                    )}

                    {/* Buttons */}
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
                                disabled={!isValid || isTestLoading}
                            >
                                {isTestLoading && <Loader2 size={14} className="spin" />}
                                Test Connection
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!isValid || isSaveLoading}
                            >
                                {isSaveLoading && <Loader2 size={14} className="spin" />}
                                {isSaveLoading ? 'Saving...' : 'Save Connection'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

import { useState, useEffect, useRef } from 'react'
import { FaTimes } from 'react-icons/fa'
import { SiSqlite } from 'react-icons/si'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useCreateConnection, useUpdateConnection, useTestConnection, type CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface SqliteConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

export function SqliteConnectionModal({
    isOpen,
    onClose,
    onBack,
    onSaveSuccess,
    userId,
    isEditing = false,
    existingConnection
}: SqliteConnectionModalProps) {
    // Form state
    const [formData, setFormData] = useState<CreateConnectionInput>({
        name: '',
        type: 'sqlite',
        userId: userId ? String(userId) : undefined,
        database: '', // For SQLite, database acts as the file path or connection string
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
                    type: 'sqlite',
                    userId: existingConnection.userId || (userId ? String(userId) : undefined),
                    database: existingConnection.database || '',
                })
            } else {
                setFormData({
                    name: '',
                    type: 'sqlite',
                    userId: userId ? String(userId) : undefined,
                    database: '',
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
        // Since sqlite is local, test by checking if database file path works
        // The testConnection mutation endpoint checks this implicitly.
        testConnection.mutate(formData)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const finalFormData = {
            ...formData,
            name: formData.name || formData.database?.split('/').pop()?.split('\\').pop() || 'SQLite Database'
        }

        if (isEditing && existingConnection?.id) {
            updateConnection.mutate(
                { id: existingConnection.id, ...finalFormData },
                {
                    onSuccess: () => {
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
            createConnection.mutate(finalFormData, {
                onSuccess: (data) => {
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
    const requiredFields = ['database']
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
                <div className="modal-header">
                    <div className="modal-header-title">
                        <SiSqlite size={24} className="sqlite" />
                        <h2>{isEditing ? 'Edit SQLite Connection' : 'New SQLite Connection'}</h2>
                    </div>
                    <div className="close-btn" onClick={onClose} role="button" tabIndex={0} aria-label="close">
                        <FaTimes size={16} />
                    </div>
                </div>

                {(isSaveError || isTestError) && (
                    <div className="message-box error">
                        <X size={14} />
                        <span>{saveError?.message || testConnection.error?.message || 'Connection failed. Please check the file path.'}</span>
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
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>File Path <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.database}
                                onChange={e => handleChange('database', e.target.value)}
                                placeholder="/absolute/path/to/database.db or :memory:"
                                ref={firstMissingRef}
                            />
                            <div className="hint">The absolute path to your SQLite database file</div>
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Connection Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="My SQLite Database"
                            />
                            <div className="hint">Optional display name</div>
                        </div>
                    </div>

                    {isTestSuccess && (
                        <div className="test-success">
                            <Check size={14} />
                            <span>Test connection successful! You can now save this connection.</span>
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

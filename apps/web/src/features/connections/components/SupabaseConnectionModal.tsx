import { useState, useEffect, useRef } from 'react'
import { FaTimes } from 'react-icons/fa'
import { SiSupabase } from 'react-icons/si'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useCreateConnection, useUpdateConnection, useTestConnection, type CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface SupabaseConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

type ConnectionMethod = 'connection-string' | 'individual'

export function SupabaseConnectionModal({
    isOpen,
    onClose,
    onBack,
    onSaveSuccess,
    userId,
    isEditing = false,
    existingConnection
}: SupabaseConnectionModalProps) {
    const [method, setMethod] = useState<ConnectionMethod>('connection-string')

    const [formData, setFormData] = useState<CreateConnectionInput>({
        name: '',
        type: 'supabase',
        userId: userId ? String(userId) : undefined,
        connectionString: '',
        host: '',
        port: 5432,
        database: 'postgres',
        username: 'postgres',
        password: '',
        ssl: true,
    })

    const firstMissingRef = useRef<HTMLInputElement>(null)

    const createConnection = useCreateConnection()
    const updateConnection = useUpdateConnection()
    const testConnection = useTestConnection()

    useEffect(() => {
        if (isOpen) {
            if (isEditing && existingConnection) {
                // Detect method from existing data
                const useConnStr = !!(existingConnection.connectionString)
                setMethod(useConnStr ? 'connection-string' : 'individual')
                setFormData({
                    name: existingConnection.name || '',
                    type: 'supabase',
                    userId: existingConnection.userId || (userId ? String(userId) : undefined),
                    connectionString: existingConnection.connectionString || '',
                    host: existingConnection.host || '',
                    port: existingConnection.port || 5432,
                    database: existingConnection.database || 'postgres',
                    username: existingConnection.username || 'postgres',
                    password: existingConnection.password || '',
                    ssl: existingConnection.ssl ?? true,
                })
            } else {
                setMethod('connection-string')
                setFormData({
                    name: '',
                    type: 'supabase',
                    userId: userId ? String(userId) : undefined,
                    connectionString: '',
                    host: '',
                    port: 5432,
                    database: 'postgres',
                    username: 'postgres',
                    password: '',
                    ssl: true,
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

    const handleTestConnection = () => {
        testConnection.mutate(formData)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Auto-generate name if empty
        const finalFormData = {
            ...formData,
            name: formData.name || (method === 'connection-string'
                ? 'Supabase Connection'
                : `${formData.host}:${formData.database}`
            ),
            // Clear fields not used by the chosen method
            connectionString: method === 'connection-string' ? formData.connectionString : undefined,
            host: method === 'individual' ? formData.host : undefined,
            port: method === 'individual' ? formData.port : undefined,
            database: method === 'individual' ? formData.database : undefined,
            username: method === 'individual' ? formData.username : undefined,
            password: method === 'individual' ? formData.password : undefined,
        }

        if (isEditing && existingConnection?.id) {
            updateConnection.mutate(
                { id: existingConnection.id, ...finalFormData },
                {
                    onSuccess: () => {
                        if (existingConnection?.id) {
                            onSaveSuccess?.(existingConnection.id)
                        }
                        setTimeout(() => { onClose() }, 1500)
                    },
                }
            )
        } else {
            createConnection.mutate(finalFormData, {
                onSuccess: (data) => {
                    if (data?.id) {
                        onSaveSuccess?.(data.id)
                    }
                    setTimeout(() => { onClose() }, 1500)
                },
            })
        }
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
    }

    // Validation
    const requiredFields = method === 'connection-string'
        ? ['connectionString']
        : ['host', 'username', 'database', 'password']

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
            <div className="connection-modal dark-theme supabase-modal">
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-title">
                        <SiSupabase size={24} style={{ color: '#3ECF8E' }} />
                        <h2>{isEditing ? 'Edit Supabase Connection' : 'New Supabase Connection'}</h2>
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

                {/* Supabase Info Banner */}
                <div className="supabase-info-banner">
                    <SiSupabase size={14} style={{ color: '#3ECF8E', flexShrink: 0 }} />
                    <span>Supabase projects are powered by PostgreSQL. Connect using your project's connection string or direct credentials.</span>
                </div>

                {/* Connection Method Toggle */}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label>Connection Method</label>
                    <div className="method-tabs">
                        <button
                            type="button"
                            className={`method-tab ${method === 'connection-string' ? 'active' : ''}`}
                            onClick={() => setMethod('connection-string')}
                        >
                            Connection String
                        </button>
                        <button
                            type="button"
                            className={`method-tab ${method === 'individual' ? 'active' : ''}`}
                            onClick={() => setMethod('individual')}
                        >
                            Individual Fields
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form className="connection-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        {method === 'connection-string' ? (
                            <>
                                {/* Connection String */}
                                <div className="form-group">
                                    <label>Connection String <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.connectionString || ''}
                                        onChange={e => handleChange('connectionString', e.target.value)}
                                        placeholder="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
                                        ref={missingFields.includes('connectionString') ? firstMissingRef : null}
                                    />
                                    <div className="hint">
                                        Find this in your Supabase dashboard → Project Settings → Database → Connection string
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Host */}
                                <div className="form-group">
                                    <label>Host <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.host || ''}
                                        onChange={e => handleChange('host', e.target.value)}
                                        placeholder="db.[project-ref].supabase.co"
                                        ref={missingFields.includes('host') ? firstMissingRef : null}
                                    />
                                    <div className="hint">Your Supabase project host (from Project Settings → Database)</div>
                                </div>

                                {/* Port */}
                                <div className="form-group">
                                    <label>Port</label>
                                    <div className="hint">Default: 5432 (direct) or 6543 (pooler)</div>
                                    <input
                                        type="number"
                                        value={formData.port || 5432}
                                        onChange={e => handleChange('port', parseInt(e.target.value) || 5432)}
                                        placeholder="5432"
                                    />
                                </div>

                                /* Database */
                                <div className="form-group">
                                    <label>Database <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.database || ''}
                                        onChange={e => handleChange('database', e.target.value)}
                                        placeholder="postgres"
                                        ref={missingFields.includes('database') ? firstMissingRef : null}
                                    />
                                    <div className="hint">For Supabase, this is almost always "postgres"</div>
                                </div>

                                {/* Username */}
                                <div className="form-group">
                                    <label>Username <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.username || ''}
                                        onChange={e => handleChange('username', e.target.value)}
                                        placeholder="postgres"
                                        ref={missingFields.includes('username') ? firstMissingRef : null}
                                    />
                                </div>

                                {/* Password */}
                                <div className="form-group">
                                    <label>Password <span className="required">*</span></label>
                                    <input
                                        type="password"
                                        value={formData.password || ''}
                                        onChange={e => handleChange('password', e.target.value)}
                                        placeholder="••••••••"
                                        ref={missingFields.includes('password') ? firstMissingRef : null}
                                    />
                                    <div className="hint">Your database password (from Project Settings → Database)</div>
                                </div>

                                {/* SSL Toggle */}
                                <div className="form-group toggle-group">
                                    <label className="toggle-label">
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={formData.ssl ?? true}
                                                onChange={e => handleChange('ssl', e.target.checked)}
                                            />
                                            <span className="slider" />
                                        </label>
                                        <span>Use SSL (recommended for Supabase)</span>
                                    </label>
                                </div>
                            </>
                        )}

                        {/* Connection Name */}
                        <div className="form-group">
                            <label>Connection Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="My Supabase Project"
                            />
                            <div className="hint">Optional display name</div>
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
                                className="btn btn-primary supabase-btn"
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

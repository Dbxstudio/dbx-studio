import { useState, useEffect, useRef } from 'react'
import { FaTimes } from 'react-icons/fa'
import { SiSnowflake } from 'react-icons/si'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useCreateConnection, useTestConnection, type CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface SnowflakeConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

export function SnowflakeConnectionModal({
    isOpen,
    onClose,
    onBack,
    userId,
    isEditing = false,
    existingConnection
}: SnowflakeConnectionModalProps) {
    // Form state
    const [formData, setFormData] = useState<CreateConnectionInput>({
        name: '',
        type: 'snowflake',
        userId: userId ? String(userId) : undefined,
        account: '',
        username: '',
        password: '',
        warehouse: '',
        database: '',
        role: '',
    })

    const [authenticator, setAuthenticator] = useState<'snowflake' | 'externalbrowser'>('snowflake')
    const firstMissingRef = useRef<HTMLInputElement>(null)

    // API mutations
    const createConnection = useCreateConnection()
    const testConnection = useTestConnection()

    // Reset on open or when existing connection changes
    useEffect(() => {
        if (isOpen) {
            if (existingConnection) {
                setFormData({
                    name: existingConnection.name || '',
                    type: 'snowflake',
                    userId: existingConnection.userId || userId ? String(userId) : undefined,
                    account: existingConnection.account || '',
                    username: existingConnection.username || '',
                    password: existingConnection.password || '',
                    warehouse: existingConnection.warehouse || '',
                    database: existingConnection.database || '',
                    role: existingConnection.role || '',
                })
            } else {
                setFormData({
                    name: '',
                    type: 'snowflake',
                    userId: userId ? String(userId) : undefined,
                    account: '',
                    username: '',
                    password: '',
                    warehouse: '',
                    database: '',
                    role: '',
                })
            }
            setAuthenticator('snowflake')
            createConnection.reset()
            testConnection.reset()
        }
    }, [isOpen, userId, existingConnection?.id])

    if (!isOpen) return null

    const isExternalBrowserAuth = authenticator === 'externalbrowser'

    const handleChange = (field: keyof CreateConnectionInput, value: string | number | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleTestConnection = async () => {
        testConnection.mutate({
            ...formData,
            // Include authenticator info if needed
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Ensure we have a connection name - use account if not provided
        const finalFormData = {
            ...formData,
            name: formData.name || `Snowflake: ${formData.account}`
        }

        createConnection.mutate(finalFormData, {
            onSuccess: () => {
                setTimeout(() => {
                    onClose()
                }, 1500)
            },
        })
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    // Validation - password not required for external browser auth
    const requiredFields = isExternalBrowserAuth
        ? ['account', 'username']
        : ['account', 'username', 'password']

    const missingFields = requiredFields.filter(f => {
        const value = formData[f as keyof CreateConnectionInput]
        return !value || (typeof value === 'string' && value.trim() === '')
    })
    const isValid = missingFields.length === 0

    const isTestLoading = testConnection.isPending
    const isTestSuccess = testConnection.isSuccess
    const isTestError = testConnection.isError
    const isSaveLoading = createConnection.isPending
    const isSaveSuccess = createConnection.isSuccess
    const isSaveError = createConnection.isError

    return (
        <div className="connection-modal-overlay" onMouseDown={handleOverlayClick}>
            <div className="connection-modal dark-theme snowflake-modal">
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-title">
                        <SiSnowflake size={24} style={{ color: '#29B5E8' }} />
                        <h2>{isEditing ? 'Edit Snowflake Connection' : 'New Snowflake Connection'}</h2>
                    </div>
                    <div className="close-btn" onClick={onClose} role="button" tabIndex={0} aria-label="close">
                        <FaTimes size={16} />
                    </div>
                </div>

                {/* Error Message */}
                {(isSaveError || isTestError) && (
                    <div className="message-box error">
                        <X size={14} />
                        <span>{createConnection.error?.message || testConnection.error?.message || 'Connection failed. Please check your credentials and try again.'}</span>
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
                        {/* Account Identifier */}
                        <div className="form-group">
                            <label>Account Identifier <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.account || ''}
                                onChange={e => handleChange('account', e.target.value)}
                                placeholder="xy12345.us-east-1"
                                ref={missingFields.includes('account') ? firstMissingRef : null}
                            />
                            <div className="hint">Your Snowflake account identifier (e.g., account-name.region.cloud)</div>
                        </div>

                        {/* Username */}
                        <div className="form-group">
                            <label>Username <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.username || ''}
                                onChange={e => handleChange('username', e.target.value)}
                                placeholder="SNOWFLAKE_USER"
                                ref={missingFields.includes('username') ? firstMissingRef : null}
                            />
                        </div>

                        {/* Authentication Method */}
                        <div className="form-group">
                            <label>Authentication Method</label>
                            <select
                                value={authenticator}
                                onChange={(e) => setAuthenticator(e.target.value as 'snowflake' | 'externalbrowser')}
                                className="form-select"
                            >
                                <option value="snowflake">Username/Password</option>
                                <option value="externalbrowser">External Browser (SSO)</option>
                            </select>
                            <div className="hint">
                                {isExternalBrowserAuth
                                    ? 'Opens browser for SSO authentication - password not required'
                                    : 'Standard username and password authentication'
                                }
                            </div>
                        </div>

                        {/* Password */}
                        <div className="form-group">
                            <label>
                                Password {!isExternalBrowserAuth && <span className="required">*</span>}
                            </label>
                            <input
                                type="password"
                                value={formData.password || ''}
                                onChange={e => handleChange('password', e.target.value)}
                                placeholder={isExternalBrowserAuth ? '(not required for SSO)' : '••••••••'}
                                disabled={isExternalBrowserAuth}
                                ref={missingFields.includes('password') ? firstMissingRef : null}
                                style={{ opacity: isExternalBrowserAuth ? 0.6 : 1 }}
                            />
                        </div>

                        {/* Warehouse (Optional) */}
                        <div className="form-group">
                            <label>Warehouse</label>
                            <input
                                type="text"
                                value={formData.warehouse || ''}
                                onChange={e => handleChange('warehouse', e.target.value)}
                                placeholder="COMPUTE_WH"
                            />
                            <div className="hint">Default warehouse for running queries (optional)</div>
                        </div>

                        {/* Database (Optional) */}
                        <div className="form-group">
                            <label>Database</label>
                            <input
                                type="text"
                                value={formData.database || ''}
                                onChange={e => handleChange('database', e.target.value)}
                                placeholder="SNOWFLAKE_SAMPLE_DATA"
                            />
                            <div className="hint">Default database to connect to (optional)</div>
                        </div>

                        {/* Role (Optional) */}
                        <div className="form-group">
                            <label>Role</label>
                            <input
                                type="text"
                                value={formData.role || ''}
                                onChange={e => handleChange('role', e.target.value)}
                                placeholder="ACCOUNTADMIN"
                            />
                            <div className="hint">Role to use for the session (optional)</div>
                        </div>

                        {/* Connection Name */}
                        <div className="form-group">
                            <label>Connection Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="My Snowflake"
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

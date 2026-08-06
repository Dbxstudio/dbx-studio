import { useState, useEffect, useRef } from 'react'
import { FaTimes } from 'react-icons/fa'
import { SiClickhouse } from 'react-icons/si'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useCreateConnection, useUpdateConnection, useTestConnection, type CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface ClickHouseConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

export function ClickHouseConnectionModal({
    isOpen,
    onClose,
    onBack,
    onSaveSuccess,
    userId,
    isEditing = false,
    existingConnection
}: ClickHouseConnectionModalProps) {
    // Form state - we use a single 'url' field for display, but map it to host/port/protocol for the backend
    const [url, setUrl] = useState('')
    const [formData, setFormData] = useState<CreateConnectionInput>({
        name: '',
        type: 'clickhouse',
        userId: userId ? String(userId) : undefined,
        host: '',
        port: 8123,
        database: 'default',
        username: 'default',
        password: '',
        protocol: 'http',
        ssl: false,
    })

    const firstMissingRef = useRef<HTMLInputElement>(null)

    // API mutations
    const createConnection = useCreateConnection()
    const updateConnection = useUpdateConnection()
    const testConnection = useTestConnection()

    // Helper to parse URL into parts
    const parseUrl = (val: string) => {
        let protocol = 'http'
        let host = val
        let port = 8123

        if (val.startsWith('https://')) {
            protocol = 'https'
            host = val.substring(8)
            port = 8443
        } else if (val.startsWith('http://')) {
            protocol = 'http'
            host = val.substring(7)
            port = 8123
        }

        // Handle path/query stripping
        if (host.includes('/')) {
            host = host.split('/')[0]
        }

        if (host.includes(':')) {
            const [h, p] = host.split(':')
            host = h
            const parsedPort = parseInt(p)
            if (!isNaN(parsedPort)) {
                port = parsedPort
            }
        }

        return { protocol, host, port, ssl: protocol === 'https' }
    }

    // When user toggles SSL manually, also update protocol if port matches defaults
    const handleSslToggle = (checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            ssl: checked,
            protocol: checked ? 'https' : 'http',
            port: checked
                ? (prev.port === 8123 ? 8443 : prev.port)
                : (prev.port === 8443 ? 8123 : prev.port),
        }))
        // Update the URL display too
        const parts = parseUrl(url)
        const newProtocol = checked ? 'https' : 'http'
        if (parts.host) {
            const newPort = checked
                ? (parts.port === 8123 ? 8443 : parts.port)
                : (parts.port === 8443 ? 8123 : parts.port)
            setUrl(`${newProtocol}://${parts.host}:${newPort}`)
        }
    }

    // Reset on open or when existing connection changes
    useEffect(() => {
        if (isOpen) {
            if (isEditing && existingConnection) {
                const initialUrl = `${existingConnection.protocol || 'http'}://${existingConnection.host}${existingConnection.port ? ':' + existingConnection.port : ''}`
                setUrl(initialUrl)
                setFormData({
                    name: existingConnection.name || '',
                    type: 'clickhouse',
                    userId: existingConnection.userId || (userId ? String(userId) : undefined),
                    host: existingConnection.host || '',
                    port: existingConnection.port || 8123,
                    database: existingConnection.database || 'default',
                    username: existingConnection.username || 'default',
                    password: existingConnection.password || '',
                    protocol: existingConnection.protocol || 'http',
                    ssl: existingConnection.ssl ?? false,
                })
            } else {
                setUrl('')
                setFormData({
                    name: '',
                    type: 'clickhouse',
                    userId: userId ? String(userId) : undefined,
                    host: '',
                    port: 8123,
                    database: 'default',
                    username: 'default',
                    password: '',
                    protocol: 'http',
                    ssl: false,
                })
            }
            createConnection.reset()
            updateConnection.reset()
            testConnection.reset()
        }
    }, [isOpen, userId, isEditing, existingConnection])

    if (!isOpen) return null

    const handleUrlChange = (val: string) => {
        setUrl(val)
        const parts = parseUrl(val)
        setFormData(prev => ({
            ...prev,
            host: parts.host,
            port: parts.port,
            protocol: parts.protocol,
            ssl: parts.ssl
        }))
    }

    const handleChange = (field: keyof CreateConnectionInput, value: string | number | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleTestConnection = async () => {
        testConnection.mutate(formData)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const finalFormData = {
            ...formData,
            name: formData.name || `${formData.host}:${formData.database}`
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
    const isValid = formData.host.trim() !== '' && formData.username.trim() !== ''

    const isTestLoading = testConnection.isPending
    const isTestSuccess = testConnection.isSuccess
    const isTestError = testConnection.isError
    const isSaveLoading = isEditing ? updateConnection.isPending : createConnection.isPending
    const isSaveSuccess = isEditing ? updateConnection.isSuccess : createConnection.isSuccess
    const isSaveError = isEditing ? updateConnection.error : createConnection.error
    const saveError = isEditing ? updateConnection.error : createConnection.error

    return (
        <div className="connection-modal-overlay" onMouseDown={handleOverlayClick}>
            <div className="clickhouse-modal dark-theme">
                {/* Header */}
                <div className="clickhouse-header">
                    <div className="clickhouse-header-content">
                        <SiClickhouse size={24} className="clickhouse-logo" />
                        <h2 className="clickhouse-title">{isEditing ? 'Edit ClickHouse Connection' : 'New ClickHouse Connection'}</h2>
                    </div>
                    <button className="clickhouse-close" onClick={onClose}>
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Error Message */}
                {(isSaveError || isTestError) && (
                    <div className="clickhouse-message error">
                        <X size={14} />
                        <span>{saveError?.message || testConnection.error?.message || 'Connection failed.'}</span>
                    </div>
                )}

                {/* Success Message */}
                {isSaveSuccess && (
                    <div className="clickhouse-message success">
                        <Check size={14} />
                        <span>{isEditing ? 'Changes saved.' : 'Connection saved.'}</span>
                    </div>
                )}

                {/* Form */}
                <form className="clickhouse-form" onSubmit={handleSubmit}>
                    <div className="clickhouse-form-sections">
                        {/* Host URL */}
                        <div className="clickhouse-form-group">
                            <label className="clickhouse-label">Host URL <span className="required-star">*</span></label>
                            <input
                                type="text"
                                className="clickhouse-input"
                                value={url}
                                onChange={e => handleUrlChange(e.target.value)}
                                placeholder="http://host:8123 or https://host:8443"
                                spellCheck={false}
                                autoFocus
                            />
                            <p className="clickhouse-hint">
                                Protocol defaults based on prefix: https defaults to 8443, http defaults to 8123.
                            </p>
                        </div>

                        {/* Username */}
                        <div className="clickhouse-form-group">
                            <label className="clickhouse-label">Username <span className="required-star">*</span></label>
                            <input
                                type="text"
                                className="clickhouse-input"
                                value={formData.username}
                                onChange={e => handleChange('username', e.target.value)}
                                placeholder="default"
                                spellCheck={false}
                            />
                        </div>

                        {/* Password */}
                        <div className="clickhouse-form-group">
                            <label className="clickhouse-label">Password <span className="label-secondary">(Optional for local)</span></label>
                            <input
                                type="password"
                                className="clickhouse-input"
                                value={formData.password}
                                onChange={e => handleChange('password', e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        {/* SSL Toggle */}
                        <div className="clickhouse-form-group">
                            <label className="clickhouse-toggle-label">
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={formData.ssl ?? false}
                                        onChange={e => handleSslToggle(e.target.checked)}
                                    />
                                    <span className="slider" />
                                </label>
                                <span className="clickhouse-label" style={{ margin: 0 }}>Use SSL / TLS</span>
                            </label>
                            <p className="clickhouse-hint" style={{ marginTop: 0 }}>
                                Enable for ClickHouse Cloud or self-hosted with TLS. Auto-detected from https:// prefix.
                            </p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="clickhouse-footer">
                        <button
                            type="button"
                            className="clickhouse-btn clickhouse-btn-secondary"
                            onClick={handleTestConnection}
                            disabled={!isValid || isTestLoading}
                        >
                            {isTestLoading ? <Loader2 size={16} className="spin" /> : 'Test Connection'}
                        </button>
                        <button
                            type="submit"
                            className="clickhouse-btn clickhouse-btn-primary"
                            disabled={!isValid || isSaveLoading}
                        >
                            {isSaveLoading ? <Loader2 size={16} className="spin" /> : 'Connect'}
                        </button>
                    </div>
                </form>

                <style dangerouslySetInnerHTML={{ __html: `
                    .clickhouse-modal {
                        background-color: #1e1e1e;
                        color: #ffffff;
                        width: 100%;
                        max-width: 540px;
                        border-radius: 12px;
                        padding: 32px;
                        border: 1px solid #333;
                        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    }
                    .clickhouse-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 32px;
                        padding-bottom: 24px;
                        border-bottom: 1px solid #333;
                    }
                    .clickhouse-header-content {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }
                    .clickhouse-logo {
                        color: #FFCC01;
                    }
                    .clickhouse-title {
                        font-size: 20px;
                        font-weight: 500;
                        margin: 0;
                    }
                    .clickhouse-close {
                        background: none;
                        border: none;
                        color: #999;
                        cursor: pointer;
                        padding: 4px;
                    }
                    .clickhouse-close:hover {
                        color: #fff;
                    }
                    .clickhouse-form-sections {
                        display: flex;
                        flex-direction: column;
                        gap: 28px;
                    }
                    .clickhouse-form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    .clickhouse-label {
                        font-size: 14px;
                        font-weight: 500;
                        color: #fff;
                    }
                    .label-secondary {
                        color: #888;
                        font-weight: 400;
                        margin-left: 4px;
                    }
                    .required-star {
                        color: #ff4d4d;
                    }
                    .clickhouse-input {
                        background-color: #121212;
                        border: 1px solid #333;
                        border-radius: 8px;
                        padding: 14px 16px;
                        color: #fff;
                        font-size: 15px;
                        transition: border-color 0.2s;
                        width: 100%;
                    }
                    .clickhouse-input:focus {
                        outline: none;
                        border-color: #444;
                    }
                    .clickhouse-input::placeholder {
                        color: #444;
                    }
                    .clickhouse-hint {
                        font-size: 12px;
                        color: #888;
                        margin: 0;
                        line-height: 1.4;
                    }
                    .clickhouse-footer {
                        margin-top: 40px;
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        padding-top: 10px;
                        border-top: 1px dashed #333;
                    }
                    .clickhouse-btn {
                        padding: 12px 36px;
                        border-radius: 6px;
                        font-size: 15px;
                        font-weight: 500;
                        cursor: pointer;
                        border: none;
                        transition: all 0.2s;
                        min-width: 140px;
                    }
                    .clickhouse-btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .clickhouse-btn-secondary {
                        background-color: #888;
                        color: #000;
                    }
                    .clickhouse-btn-secondary:hover:not(:disabled) {
                        background-color: #aaa;
                    }
                    .clickhouse-btn-primary {
                        background-color: #888;
                        color: #000;
                    }
                    .clickhouse-btn-primary:hover:not(:disabled) {
                        background-color: #aaa;
                    }
                    .clickhouse-message {
                        margin-bottom: 24px;
                        padding: 12px;
                        border-radius: 6px;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .clickhouse-message.error {
                        background-color: rgba(255, 77, 77, 0.1);
                        color: #ff4d4d;
                        border: 1px solid rgba(255, 77, 77, 0.2);
                    }
                    .clickhouse-message.success {
                        background-color: rgba(62, 207, 142, 0.1);
                        color: #3ecf8e;
                        border: 1px solid rgba(62, 207, 142, 0.2);
                    }
                    .spin {
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .clickhouse-toggle-label {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        cursor: pointer;
                    }
                `}} />
            </div>
        </div>
    )
}

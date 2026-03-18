import { useEffect, useRef, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { SiGooglebigquery } from 'react-icons/si'
import { ArrowLeft, Check, Loader2, X } from 'lucide-react'
import { useCreateConnection, useTestConnection, useUpdateConnection, type CreateConnectionInput } from '../../../shared/hooks'
import { buildBigQueryConnectionString, parseBigQueryConnectionString } from '../../../shared/utils/connectionString'
import './connection-modal.css'

interface BigQueryConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

export function BigQueryConnectionModal({
    isOpen,
    onClose,
    onBack,
    onSaveSuccess,
    userId,
    isEditing = false,
    existingConnection,
}: BigQueryConnectionModalProps) {
    const [lastAction, setLastAction] = useState<'test' | 'save' | null>(null)

    const normalizeKeyFilename = (value: string) => {
        const trimmed = value.trim()

        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            return trimmed.slice(1, -1).trim()
        }

        return trimmed
    }

    const [formData, setFormData] = useState<CreateConnectionInput>({
        name: '',
        type: 'bigquery',
        userId: userId ? String(userId) : undefined,
        projectId: '',
        keyFilename: '',
        dataset: '',
    })

    const firstMissingRef = useRef<HTMLInputElement>(null)

    const createConnection = useCreateConnection()
    const updateConnection = useUpdateConnection()
    const testConnection = useTestConnection()

    useEffect(() => {
        if (!isOpen) return

        if (isEditing && existingConnection) {
            const parsed = parseBigQueryConnectionString(existingConnection.connectionString)
            setFormData({
                name: existingConnection.name || '',
                type: 'bigquery',
                userId: existingConnection.userId || (userId ? String(userId) : undefined),
                projectId: existingConnection.projectId || parsed?.projectId || '',
                keyFilename: existingConnection.keyFilename || parsed?.keyFilename || '',
                dataset: existingConnection.dataset || parsed?.dataset || '',
                connectionString: existingConnection.connectionString,
            })
        } else {
            setFormData({
                name: '',
                type: 'bigquery',
                userId: userId ? String(userId) : undefined,
                projectId: '',
                keyFilename: '',
                dataset: '',
            })
        }

        createConnection.reset()
        updateConnection.reset()
        testConnection.reset()
        setLastAction(null)
    }, [isOpen, userId, isEditing, existingConnection])

    if (!isOpen) return null

    const handleChange = (field: keyof CreateConnectionInput, value: string | number | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const requiredFields: Array<keyof CreateConnectionInput> = ['projectId', 'keyFilename']
    const missingFields = requiredFields.filter((field) => {
        const value = formData[field]
        return !value || (typeof value === 'string' && value.trim() === '')
    })

    const isValid = missingFields.length === 0

    const normalizedKeyFilename = normalizeKeyFilename(formData.keyFilename || '')

    const preparedConnectionString = formData.projectId && normalizedKeyFilename
        ? buildBigQueryConnectionString({
            projectId: formData.projectId,
            keyFilename: normalizedKeyFilename,
            dataset: formData.dataset,
        })
        : undefined

    const finalPayload: CreateConnectionInput = {
        ...formData,
        name: formData.name || `BigQuery: ${formData.projectId}`,
        type: 'bigquery',
        keyFilename: normalizedKeyFilename,
        connectionString: preparedConnectionString,
    }

    const handleTestConnection = () => {
        setLastAction('test')
        createConnection.reset()
        updateConnection.reset()
        testConnection.mutate(finalPayload)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setLastAction('save')
        testConnection.reset()

        if (isEditing && existingConnection?.id) {
            updateConnection.mutate(
                { id: existingConnection.id, ...finalPayload },
                {
                    onSuccess: () => {
                        onSaveSuccess?.(existingConnection.id!)
                        window.setTimeout(() => onClose(), 1200)
                    },
                },
            )
            return
        }

        createConnection.mutate(finalPayload, {
            onSuccess: (data) => {
                if (data?.id) {
                    onSaveSuccess?.(data.id)
                }
                window.setTimeout(() => onClose(), 1200)
            },
        })
    }

    const isTestLoading = testConnection.isPending
    const isTestSuccess = testConnection.isSuccess
    const isTestError = testConnection.isError
    const isSaveLoading = isEditing ? updateConnection.isPending : createConnection.isPending
    const isSaveSuccess = isEditing ? updateConnection.isSuccess : createConnection.isSuccess
    const isSaveError = isEditing ? updateConnection.isError : createConnection.isError
    const saveError = isEditing ? updateConnection.error : createConnection.error
    const displayedError =
        lastAction === 'save'
            ? saveError?.message
            : lastAction === 'test'
                ? testConnection.error?.message
                : (saveError?.message || testConnection.error?.message)

    return (
        <div className="connection-modal-overlay" onMouseDown={handleOverlayClick}>
            <div className="connection-modal dark-theme">
                <div className="modal-header">
                    <div className="modal-header-title">
                        <SiGooglebigquery size={24} className="bigquery" />
                        <h2>{isEditing ? 'Edit BigQuery Connection' : 'New BigQuery Connection'}</h2>
                    </div>
                    <div className="close-btn" onClick={onClose} role="button" tabIndex={0} aria-label="close">
                        <FaTimes size={16} />
                    </div>
                </div>

                {(isSaveError || isTestError) && displayedError && (
                    <div className="message-box error">
                        <X size={14} />
                        <span>{displayedError || 'BigQuery connection failed. Check project ID and key file path.'}</span>
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
                            <label>Project ID <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.projectId || ''}
                                onChange={(e) => handleChange('projectId', e.target.value)}
                                placeholder="my-gcp-project"
                                ref={missingFields.includes('projectId') ? firstMissingRef : null}
                            />
                        </div>

                        <div className="form-group">
                            <label>Key Filename <span className="required">*</span></label>
                            <input
                                type="text"
                                value={formData.keyFilename || ''}
                                onChange={(e) => handleChange('keyFilename', e.target.value)}
                                placeholder="C:/keys/service-account.json"
                                ref={missingFields.includes('keyFilename') ? firstMissingRef : null}
                            />
                            <div className="hint">Absolute path to the Google service-account JSON file</div>
                        </div>

                        <div className="form-group">
                            <label>Dataset</label>
                            <input
                                type="text"
                                value={formData.dataset || ''}
                                onChange={(e) => handleChange('dataset', e.target.value)}
                                placeholder="analytics"
                            />
                            <div className="hint">Optional default dataset (schema) for browsing and queries</div>
                        </div>

                        <div className="form-group">
                            <label>Connection Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="My BigQuery"
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
                        <button type="button" className="btn btn-secondary" onClick={onBack}>
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
                            <button type="submit" className="btn btn-primary" disabled={!isValid || isSaveLoading}>
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

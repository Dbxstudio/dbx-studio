import { useState, useEffect } from 'react'
import { ConnectionTypeSelector, type ConnectionType } from './ConnectionTypeSelector'
import { PostgresConnectionModal } from './PostgresConnectionModal'
import { SnowflakeConnectionModal } from './SnowflakeConnectionModal'
import type { CreateConnectionInput } from '../../../shared/hooks'
import './connection-modal.css'

interface ConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

/**
 * ConnectionModal - Similar to sumr-ai-sql-client's connection modal system
 * 
 * Flow:
 * 1. First shows ConnectionTypeSelector to choose database type
 * 2. Then shows type-specific modal (PostgreSQL, Snowflake, etc.)
 * 
 * All connections are saved via server API (not local agents)
 */
export function ConnectionModal({
    isOpen,
    onClose,
    userId,
    isEditing = false,
    existingConnection
}: ConnectionModalProps) {
    // Modal step state
    const [step, setStep] = useState<'select-type' | 'form'>('select-type')
    const [selectedType, setSelectedType] = useState<ConnectionType | null>(null)

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            // If editing, skip type selection and go directly to form
            if (isEditing && existingConnection?.type) {
                setSelectedType(existingConnection.type as ConnectionType)
                setStep('form')
            } else {
                setStep('select-type')
                setSelectedType(null)
            }
        }
    }, [isOpen, isEditing, existingConnection?.type])

    // Handler for type selection
    const handleSelectType = (type: ConnectionType) => {
        setSelectedType(type)
        setStep('form')
    }

    // Handler to go back to type selection
    const handleBack = () => {
        setStep('select-type')
        setSelectedType(null)
    }

    // Handler to close the modal
    const handleClose = () => {
        onClose()
    }

    // Step 1: Show type selector
    if (step === 'select-type') {
        return (
            <ConnectionTypeSelector
                isOpen={isOpen}
                onClose={handleClose}
                onSelectType={handleSelectType}
            />
        )
    }

    // Step 2: Show type-specific modal
    switch (selectedType) {
        case 'postgresql':
            return (
                <PostgresConnectionModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onBack={handleBack}
                    userId={userId}
                    isEditing={isEditing}
                    existingConnection={existingConnection}
                />
            )

        case 'snowflake':
            return (
                <SnowflakeConnectionModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onBack={handleBack}
                    userId={userId}
                    isEditing={isEditing}
                    existingConnection={existingConnection}
                />
            )

        // For unsupported types, fall back to type selector
        default:
            return (
                <ConnectionTypeSelector
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSelectType={handleSelectType}
                />
            )
    }
}

// Export individual components for direct use if needed
export { ConnectionTypeSelector } from './ConnectionTypeSelector'
export { PostgresConnectionModal } from './PostgresConnectionModal'
export { SnowflakeConnectionModal } from './SnowflakeConnectionModal'

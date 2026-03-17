import type { CreateConnectionInput } from '../../../shared/hooks'
import { MysqlFamilyConnectionModal } from './MysqlConnectionModal'

interface MariadbConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    onBack: () => void
    onSaveSuccess?: (connectionId: string) => void
    userId?: string
    isEditing?: boolean
    existingConnection?: Partial<CreateConnectionInput> & { id?: string }
}

export function MariadbConnectionModal(props: MariadbConnectionModalProps) {
    return <MysqlFamilyConnectionModal {...props} variant="mariadb" />
}
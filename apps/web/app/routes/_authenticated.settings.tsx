import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '~/features/settings'

export const Route = createFileRoute('/_authenticated/settings')({
    component: Settings,
})

function Settings() {
    return <SettingsPage />
}

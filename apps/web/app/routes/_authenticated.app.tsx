import { createFileRoute } from '@tanstack/react-router'
import Workspace from '~/components/Workspace'

export const Route = createFileRoute('/_authenticated/app')({
    component: AppPage,
})

function AppPage() {
    return <Workspace />
}

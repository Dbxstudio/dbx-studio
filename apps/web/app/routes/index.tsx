import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: IndexPage,
})

function IndexPage() {
    return <Navigate to="/app" />
}

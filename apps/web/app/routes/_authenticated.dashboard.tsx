import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
    component: Dashboard,
})

function Dashboard() {
    return (
        <div className="dashboard-view">
            <h1>Dashboard</h1>
            <p>Coming soon...</p>
        </div>
    )
}

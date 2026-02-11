import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/login')({
    component: LoginPage,
})

function LoginPage() {
    const navigate = useNavigate()

    // Auto-redirect to app (no login required)
    useEffect(() => {
        navigate({ to: '/app' })
    }, [navigate])

    return (
        <div className="query-main-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#fff', fontSize: '18px' }}>Redirecting...</div>
        </div>
    )
}

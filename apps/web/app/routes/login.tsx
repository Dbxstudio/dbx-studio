import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth, Login } from '~/features/auth'
import { useEffect } from 'react'

export const Route = createFileRoute('/login')({
    component: LoginPage,
})

function LoginPage() {
    const { isAuthenticated, isLoading } = useAuth()
    const navigate = useNavigate()

    // Redirect to app if already authenticated
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            navigate({ to: '/app' })
        }
    }, [isAuthenticated, isLoading, navigate])

    if (isLoading) {
        return (
            <div className="query-main-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#fff', fontSize: '18px' }}>Loading...</div>
            </div>
        )
    }

    return <Login onSuccess={() => navigate({ to: '/app' })} />
}

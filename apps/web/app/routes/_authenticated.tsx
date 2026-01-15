import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuth } from '~/features/auth'

export const Route = createFileRoute('/_authenticated')({
    beforeLoad: async ({ location }) => {
        // This will be handled client-side by the component
        // For server-side auth checking, you'd implement proper SSR auth here
    },
    component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
    const { isAuthenticated, isLoading } = useAuth()

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="query-main-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#fff', fontSize: '18px' }}>Loading...</div>
            </div>
        )
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        if (typeof window !== 'undefined') {
            window.location.href = '/login'
        }
        return null
    }

    // Render authenticated routes
    return <Outlet />
}

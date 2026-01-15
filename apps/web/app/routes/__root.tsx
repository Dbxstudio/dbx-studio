import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '~/features/auth'
import '~/styles/globals.css'

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
})

export const Route = createRootRoute({
    component: RootComponent,
})

function RootComponent() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <Outlet />
                <Toaster theme="dark" position="bottom-right" richColors closeButton />
            </AuthProvider>
        </QueryClientProvider>
    )
}

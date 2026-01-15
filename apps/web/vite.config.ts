import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '~': resolve(__dirname, './src'),
            '@': resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5174,
        strictPort: false,
        proxy: {
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true,
    },
})

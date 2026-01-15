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
        port: 5173,
        strictPort: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
})

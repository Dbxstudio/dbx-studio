import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    main: {
        build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/main/index.ts'),
                },
            },
        },
    },
    preload: {
        build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload/index.ts'),
                },
            },
        },
    },
    renderer: {
        root: '.',
        build: {
            outDir: 'dist',
        },
        plugins: [react()],
        resolve: {
            alias: {
                '~': resolve(__dirname, './src'),
                '@': resolve(__dirname, './src'),
            },
        },
    },
})

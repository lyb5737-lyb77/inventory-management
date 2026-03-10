import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/inventory-management/', // GitHub Pages 배포를 위한 base URL
    plugins: [react()],
    build: {
        target: 'es2022', // top-level await 지원
        sourcemap: false, // OOM 방지를 위해 소스맵 끔
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    msal: ['@azure/msal-browser', '@azure/msal-react'],
                    graph: ['@microsoft/microsoft-graph-client'],
                    utils: ['xlsx']
                }
            }
        }
    },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/inventory-management/', // GitHub Pages 배포를 위한 base URL
    plugins: [react()],
    build: {
        target: 'es2022', // top-level await 지원
    },
})

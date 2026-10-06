import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cấu hình Vite dùng plugin React để biên dịch JSX và hỗ trợ môi trường phát triển.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // App①（OIDC / JWT）の直接発行モードは相対パスで fetch するため、
    // 既存アプリと同じプロキシ設定を維持する（backend: 8000）
    proxy: {
      '/idp': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/public-key': 'http://localhost:8000',
    },
  },
})

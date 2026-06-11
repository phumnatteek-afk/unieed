import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["draven-achronychous-hazel.ngrok-free.dev"],
    // ✅ เพิ่มตรงนี้
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
    // SPA fallback — ทุก path ที่ไม่ใช่ API ให้ serve index.html
    historyApiFallback: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})
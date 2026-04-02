import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["draven-achronychous-hazel.ngrok-free.dev"],
    proxy: {
      "/api": {                          // ← เปลี่ยนจาก /market เป็น /api
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/school": {                        // ← เพิ่มตรงนี้
    target: "http://localhost:3000",
    changeOrigin: true,
  },
    },
  },
})
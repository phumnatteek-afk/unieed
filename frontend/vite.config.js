import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["draven-achronychous-hazel.ngrok-free.dev"],
    proxy: {                                    // ← เพิ่มตรงนี้
      "/market": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
})
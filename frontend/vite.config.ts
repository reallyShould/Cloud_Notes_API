import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'editor-vendor'
          }
          if (id.includes('lucide-react')) return 'icons-vendor'
          if (id.includes('react')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})

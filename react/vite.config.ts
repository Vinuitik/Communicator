import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': '/src',
      '@/components': '/src/components',
      '@/atoms': '/src/components/atoms',
      '@/molecules': '/src/components/molecules',
      '@/organisms': '/src/components/organisms',
      '@/templates': '/src/components/templates',
      '@/pages': '/src/components/pages',
      '@/hooks': '/src/hooks',
      '@/utils': '/src/utils',
      '@/types': '/src/types',
      '@/services': '/src/services',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})

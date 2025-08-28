import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vite configuration - modern build tool that's faster than Webpack
// WHY Vite? Hot reload is instant, builds are fast, works great with React
export default defineConfig({
  // React plugin enables JSX support and hot module replacement
  plugins: [react()],
  resolve: {
    // Path aliases - same as TypeScript config, allows clean imports
    // Instead of '../../../components' you can write '@/components'
    alias: {
      '@': path.resolve('./src'),
      '@/components': path.resolve('./src/components'),
      '@/atoms': path.resolve('./src/components/atoms'),
      '@/molecules': path.resolve('./src/components/molecules'),
      '@/organisms': path.resolve('./src/components/organisms'),
      '@/templates': path.resolve('./src/components/templates'),
      '@/pages': path.resolve('./src/pages'),
      '@/assets': path.resolve('./src/assets'),
      '@/styles': path.resolve('./src/styles'),
      '@/utils': path.resolve('./src/utils'),
      '@/services': path.resolve('./src/services'),
      '@/hooks': path.resolve('./src/hooks'),
      '@/context': path.resolve('./src/context')
    }
  },
  server: {
    // Development server settings
    port: 3000,  // Run on localhost:3000
    host: true   // Allow access from other devices on network
  }
})

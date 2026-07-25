/// <reference types="vitest" />

import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
// No @vitejs/plugin-legacy: this app only ships as an Android Capacitor build
// (minSdk 26, always a modern Chromium WebView), never as a public web
// deploy, so the legacy ES5 fallback bundle + polyfills + feature-detection
// loader that plugin adds is pure dead weight on every app open.
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/ionicons')) {
            return 'ionicons-vendor';
          }
          if (id.includes('node_modules/@ionic/core')) {
            return 'ionic-core-vendor';
          }
          if (id.includes('node_modules/@ionic')) {
            return 'ionic-vendor';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})

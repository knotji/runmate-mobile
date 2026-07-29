/// <reference types="vitest" />

import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const packageVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version
const commitCount = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim())

// https://vitejs.dev/config/
// No @vitejs/plugin-legacy: this app only ships as an Android Capacitor build
// (minSdk 26, always a modern Chromium WebView), never as a public web
// deploy, so the legacy ES5 fallback bundle + polyfills + feature-detection
// loader that plugin adds is pure dead weight on every app open.
export default defineConfig({
  define: {
    __RUNMATE_VERSION__: JSON.stringify(packageVersion),
    __RUNMATE_BUILD_CODE__: JSON.stringify(String(1000 + commitCount)),
    __RUNMATE_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
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

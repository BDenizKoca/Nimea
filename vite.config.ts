import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false, // Eleventy also writes to dist
    rollupOptions: {
      input: {
        map: resolve(__dirname, 'src/map/main.ts'),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name].[ext]'
      }
    },
    sourcemap: true,
    minify: 'esbuild', // Faster than terser, built into Vite
    target: 'es2020'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})

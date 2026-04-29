import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget =
    env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000'

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json'],
        reportsDirectory: path.resolve(__dirname, 'coverage'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})

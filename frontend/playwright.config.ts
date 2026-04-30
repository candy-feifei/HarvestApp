import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 本地默认可复用已占用的 :5173（`npm run dev`）；在 CI 或你显式关复用时为 false，避免复用到僵死进程时踩坑可设
 * `PLAYWRIGHT_REUSE_VITE=0`。
 */
const reuseVite =
  process.env.PLAYWRIGHT_REUSE_VITE === '0'
    ? false
    : !process.env.CI
/** 仅使用项目名前缀，避免与误设的通用 `PLAYWRIGHT_*` 环境变量冲突 */
const e2eNoWeb = process.env.HARVESTAPP_E2E_NO_WEB === '1'

/**
 * 仅自动拉起 Vite。Nest 与 PostgreSQL 需已就绪（`docker compose up` + `cd backend && npm run start:dev`，并完成 migrate/seed）。
 * 若前后端均手动已起，可设 `HARVESTAPP_E2E_NO_WEB=1` 跳过本配置里的 Vite 子进程。
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: e2eNoWeb
    ? undefined
    : {
        command: 'npm run dev -- --port 5174 --strictPort',
        cwd: __dirname,
        url: 'http://localhost:5174',
        reuseExistingServer: reuseVite,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})

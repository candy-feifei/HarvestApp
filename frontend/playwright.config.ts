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
/**
 * 由 `e2e-run.mjs` 拉起前端时设为 `1`，避免 Playwright 再启一个 Vite。
 * 若你**自己**已 `npm run dev` 且只想跑 Playwright，也可设 `PLAYWRIGHT_SKIP_WEBSERVER=1`。
 * （不再读取 `HARVESTAPP_E2E_NO_WEB`，以免历史环境变量误关 webServer 导致 `ERR_CONNECTION_REFUSED`。）
 */
const e2eNoWeb = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

const slowMoMs = Number(process.env.PLAYWRIGHT_SLOW_MO ?? '0')

/**
 * 仅自动拉起 Vite。Nest 与 PostgreSQL 需已就绪（`docker compose up` + `cd backend && npm run start:dev`，并完成 migrate/seed），
 * 或直接使用 `npm run test:e2e` / `npm run test:e2e:journey` 由脚本拉起。
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    [
      'html',
      {
        open: 'never',
        outputFolder: 'playwright-report',
      },
    ],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(Number.isFinite(slowMoMs) && slowMoMs > 0
          ? { launchOptions: { slowMo: slowMoMs } }
          : {}),
      },
    },
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

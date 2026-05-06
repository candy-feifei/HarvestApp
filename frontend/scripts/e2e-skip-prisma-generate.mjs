/**
 * 在 Windows 上 backend 的 Prisma 引擎 DLL 常被已运行的 nest/node 占用，generate 会 EPERM。
 * 本入口先设 E2E_SKIP_PRISMA_GENERATE=1，再把其余参数转给 e2e-run.mjs。
 *
 * 例：npm run test:e2e:ui:fast
 * 等价：E2E_SKIP_PRISMA_GENERATE=1 node ./scripts/e2e-run.mjs --ui --playwright-file e2e/app-journey.spec.ts
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.E2E_SKIP_PRISMA_GENERATE = '1'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.dirname(__dirname)
const runner = path.join(__dirname, 'e2e-run.mjs')
const forwarded = process.argv.slice(2)

const r = spawnSync(process.execPath, [runner, ...forwarded], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: process.env,
  shell: true,
})
process.exit(r.status ?? 1)

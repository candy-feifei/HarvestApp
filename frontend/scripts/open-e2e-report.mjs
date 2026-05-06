/**
 * 在 frontend 根目录解析 playwright-report 绝对路径并打开；
 * 若尚未跑过带 HTML reporter 的测试，给出明确提示。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.dirname(__dirname)
const reportDir = path.join(frontendDir, 'playwright-report')
const indexHtml = path.join(reportDir, 'index.html')

if (!fs.existsSync(indexHtml)) {
  console.error('[e2e] 未找到 HTML 报告:', reportDir)
  console.error('')
  console.error('请先在本仓库 frontend 目录成功跑完一次 E2E（会生成 playwright-report），例如：')
  console.error('  cd path/to/HarvestApp/frontend')
  console.error('  npm run test:e2e:journey')
  console.error('')
  console.error('若你在别的目录执行了 npm run test:e2e:report:open，请改为在 frontend 下执行。')
  process.exit(1)
}

const r = spawnSync(
  `npx playwright show-report "${reportDir.replace(/\\/g, '/')}"`,
  {
    cwd: frontendDir,
    shell: true,
    stdio: 'inherit',
    windowsHide: true,
  },
)
process.exit(r.status ?? 1)

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(process.cwd(), '..')
const backendDir = path.join(repoRoot, 'backend')
const frontendDir = process.cwd()

const FRONTEND_PORT = Number(process.env.E2E_WEB_PORT ?? 5174)
const BACKEND_PORT = Number(process.env.E2E_API_PORT ?? 3000)

const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? `http://localhost:${FRONTEND_PORT}`
const API_ORIGIN = process.env.E2E_API_ORIGIN ?? `http://localhost:${BACKEND_PORT}`
const API_HEALTH_URL = `${API_ORIGIN}/api/health`

const args = process.argv.slice(2)

/** 录屏：放慢浏览器操作 + 步骤间停顿（可用环境变量覆盖） */
if (args.includes('--record')) {
  if (!process.env.PLAYWRIGHT_SLOW_MO) {
    process.env.PLAYWRIGHT_SLOW_MO = '280'
  }
  if (!process.env.E2E_STEP_DELAY_MS) {
    process.env.E2E_STEP_DELAY_MS = '900'
  }
  console.log(
    `[e2e] --record: PLAYWRIGHT_SLOW_MO=${process.env.PLAYWRIGHT_SLOW_MO} E2E_STEP_DELAY_MS=${process.env.E2E_STEP_DELAY_MS}`,
  )
}

const ui = args.includes('--ui')
const pfIdx = args.indexOf('--playwright-file')
const playwrightFile =
  pfIdx >= 0 && args[pfIdx + 1] && !args[pfIdx + 1].startsWith('-')
    ? ` ${args[pfIdx + 1]}`
    : ''

function sh(cmd, { cwd, env } = {}) {
  // PowerShell 会把 `&&` / 引号处理得很怪，这里统一用 `shell: true` 交给系统默认 shell。
  const child = spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: 'inherit',
    windowsHide: true,
  })
  return child
}

function shOk(cmd, { cwd, env } = {}) {
  const res = spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (res.status !== 0) {
    throw new Error(`命令失败(${res.status}): ${cmd}`)
  }
}

async function shOkRetry(cmd, { cwd, env, retries = 5, delayMs = 2000 } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      shOk(cmd, { cwd, env })
      return
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        // Windows 下 prisma generate 偶发 EPERM（文件短暂被占用），等待后重试往往可恢复
        await sleep(delayMs)
        continue
      }
    }
  }
  throw lastErr
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

/** Docker health=healthy 后，主机侧端口映射仍可能晚几拍就绪；与 Prisma 一样连 TCP 再往下跑。 */
async function waitForTcpPort(
  host,
  port,
  { timeoutMs = 120_000, intervalMs = 500 } = {},
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ host, port }, () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('error', () => resolve(false))
      socket.setTimeout(4000, () => {
        socket.destroy()
        resolve(false)
      })
    })
    if (ok) return
    await sleep(intervalMs)
  }
  throw new Error(
    `TCP ${host}:${port} 在 ${timeoutMs}ms 内仍不可连（请确认 Docker 已映射该端口且无其它进程占用）`,
  )
}

async function waitForHttpOk(url, { timeoutMs = 180_000, intervalMs = 1500 } = {}) {
  const startedAt = Date.now()
  // Node 20+ 自带 fetch
  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`等待超时: ${url}`)
    }
    try {
      const res = await fetch(url, { method: 'GET' })
      if (res.ok) return
    } catch {
      // ignore
    }
    await sleep(intervalMs)
  }
}

function taskkill(pid) {
  if (!pid) return
  try {
    spawnSync(`taskkill /pid ${pid} /t /f`, {
      shell: true,
      stdio: 'ignore',
      windowsHide: true,
    })
  } catch {
    // ignore
  }
}

function hasNodeModules(dir) {
  return fs.existsSync(path.join(dir, 'node_modules'))
}

function execOut(cmd, { cwd, env } = {}) {
  const res = spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return {
    status: res.status ?? 1,
    stdout: String(res.stdout ?? '').trim(),
    stderr: String(res.stderr ?? '').trim(),
  }
}

async function waitForDockerPostgresHealthy({ timeoutMs = 120_000, intervalMs = 2000 } = {}) {
  const startedAt = Date.now()
  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        '等待 Postgres 就绪超时。请确认 Docker Desktop 正常运行，且 `docker compose up -d postgres` 能启动容器。',
      )
    }

    // 优先读取 compose 容器 health 状态（docker-compose.yml 已配置 healthcheck）
    const idRes = execOut('docker compose ps -q postgres', { cwd: repoRoot })
    const containerId = idRes.status === 0 ? idRes.stdout : ''
    if (containerId) {
      const healthRes = execOut(
        `docker inspect -f "{{.State.Health.Status}}" ${containerId}`,
        { cwd: repoRoot },
      )
      const health = healthRes.stdout.replace(/"/g, '')
      if (health === 'healthy') return
      // 如果 health 为空（极少数情况下 healthcheck 未生效），退回到 pg_isready
      if (!health) {
        const readyRes = execOut(
          `docker exec ${containerId} pg_isready -U postgres -d harvestapp`,
          { cwd: repoRoot },
        )
        if (readyRes.status === 0) return
      }
    }

    await sleep(intervalMs)
  }
}

function ensureBackendEnv() {
  // 给 E2E 一套默认 env，不要求用户手工复制 .env
  return {
    PORT: String(BACKEND_PORT),
    NODE_ENV: 'test',
    JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-dev-secret',
    APP_PUBLIC_URL: WEB_ORIGIN,
    // 与 docker-compose.yml 默认一致
    DATABASE_URL:
      process.env.DATABASE_URL ??
      // Windows 上少数环境 localhost 解析会坑（IPv6/代理/hosts），用 127.0.0.1 更稳
      'postgresql://postgres:postgres@127.0.0.1:5432/harvestapp?schema=public',
  }
}

async function main() {
  const children = []
  let cleaning = false

  const cleanup = () => {
    if (cleaning) return
    cleaning = true
    for (const c of children.reverse()) taskkill(c.pid)
  }

  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })
  process.on('exit', cleanup)

  // 1) Postgres
  shOk('docker compose up -d postgres', { cwd: repoRoot })
  await waitForDockerPostgresHealthy({ timeoutMs: 180_000, intervalMs: 2000 })
  await waitForTcpPort('127.0.0.1', 5432, { timeoutMs: 120_000, intervalMs: 400 })

  // 2) backend deps + migrate + seed
  if (!hasNodeModules(backendDir)) {
    shOk('npm install', { cwd: backendDir })
  }
  // Prisma 客户端生成（Windows 上若 backend 已有 nest/node 占用 query_engine*.dll 会 EPERM）
  if (process.env.E2E_SKIP_PRISMA_GENERATE === '1') {
    console.warn(
      '[e2e] 已跳过 prisma generate（E2E_SKIP_PRISMA_GENERATE=1）。请确认本机已生成过 @prisma/client。',
    )
  } else {
    if (process.platform === 'win32') {
      console.warn(
        '[e2e] Windows：若 prisma generate 报 EPERM，请先关闭正在运行的 backend（nest start 等），或设置环境变量 E2E_SKIP_PRISMA_GENERATE=1 后重试。',
      )
    }
    await sleep(2000)
    await shOkRetry('npm run prisma:generate', {
      cwd: backendDir,
      retries: 12,
      delayMs: 4000,
    })
  }
  await shOkRetry('npx prisma migrate deploy', {
    cwd: backendDir,
    env: ensureBackendEnv(),
    retries: 10,
    delayMs: 3000,
  })
  shOk('npm run prisma:seed', {
    cwd: backendDir,
    env: ensureBackendEnv(),
  })

  // 3) start backend（E2E 用一次性启动即可；--watch 在部分环境下编译结束后迟迟不 listen，健康检查易超时）
  const backend = sh('npm run start', {
    cwd: backendDir,
    env: ensureBackendEnv(),
  })
  children.push(backend)

  await waitForHttpOk(API_HEALTH_URL, { timeoutMs: 300_000, intervalMs: 1500 })

  // 4) start frontend
  if (!hasNodeModules(frontendDir)) {
    shOk('npm install', { cwd: frontendDir })
  }

  const frontend = sh(`npm run dev -- --port ${FRONTEND_PORT} --strictPort`, {
    cwd: frontendDir,
    env: {
      // 让前端直连后端（也可保持 /api 走代理，但 E2E 下用直连更不容易受 host 影响）
      VITE_API_BASE_URL: `${API_ORIGIN}/api`,
    },
  })
  children.push(frontend)

  await waitForHttpOk(`${WEB_ORIGIN}/`, { timeoutMs: 180_000, intervalMs: 1500 })

  // 5) run playwright（由本脚本已起 Vite，子进程只跳过 Playwright 自带 webServer）
  const cmd = ui
    ? `npx playwright test --ui${playwrightFile}`
    : `npx playwright test${playwrightFile}`
  shOk(cmd, {
    cwd: frontendDir,
    env: {
      PLAYWRIGHT_BASE_URL: WEB_ORIGIN,
      E2E_API_HEALTH_URL: API_HEALTH_URL,
      PLAYWRIGHT_SKIP_WEBSERVER: '1',
    },
  })

  // Playwright 跑完就关掉前后端子进程，保证“一键跑通”不悬挂
  cleanup()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


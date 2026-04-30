import { expect, test } from '@playwright/test'

const defaultEmail = process.env.E2E_USER_EMAIL ?? 'demo@harvest.app'
const defaultPassword = process.env.E2E_USER_PASSWORD ?? 'demo123'
const apiHealthUrl = process.env.E2E_API_HEALTH_URL ?? 'http://localhost:3000/api/health'

test.describe('Login and sidebar', () => {
  test('登录后可通过侧栏进入业务页', async ({ page, request }) => {
    await expect
      .poll(
        async () => {
          try {
            const r = await request.get(apiHealthUrl)
            return r.status()
          } catch {
            return 0
          }
        },
        { timeout: 100_000, intervals: [1000, 2000, 5000, 5000, 10_000] },
      )
      .toBe(200)

    await page.goto('/login')
    await expect(page.getByTestId('login-form')).toBeVisible()
    await page.getByTestId('login-email').fill(defaultEmail)
    await page.getByTestId('login-password').fill(defaultPassword)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/time$/, { timeout: 30_000 })

    await page.getByTestId('sidebar-nav-clients').click()
    await expect(page).toHaveURL(/\/clients$/, { timeout: 20_000 })

    await page.getByTestId('sidebar-nav-tasks').click()
    await expect(page).toHaveURL(/\/tasks$/, { timeout: 20_000 })
  })
})

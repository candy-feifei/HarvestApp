import { expect, type APIRequestContext, type Page } from '@playwright/test'

const defaultEmail = process.env.E2E_USER_EMAIL ?? 'demo@harvest.app'
const defaultPassword = process.env.E2E_USER_PASSWORD ?? 'demo123'
const apiHealthUrl = process.env.E2E_API_HEALTH_URL ?? 'http://localhost:3000/api/health'

export async function waitForApiHealthy(request: APIRequestContext) {
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
}

/** Log in from /login with the demo account; assert we land on the timesheet page. */
export async function loginAsDemo(page: Page) {
  await page.goto('/login')
  await expect(page.getByTestId('login-form')).toBeVisible()
  await page.getByTestId('login-email').fill(defaultEmail)
  await page.getByTestId('login-password').fill(defaultPassword)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/time$/, { timeout: 30_000 })
}

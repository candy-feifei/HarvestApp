import { expect, test } from '@playwright/test'
import { clientListRow, projectTableRow } from './helpers/clients-projects-rows'
import { loginAsDemo, waitForApiHealthy } from './helpers/login'
import { buildSidebarNavPagesInOrder } from './helpers/sidebar-pages'
import { e2eStepPause } from './helpers/step-pause'
import { taskRow } from './helpers/task-row'

/**
 * Full journey: log in → sidebar (all nav items) → **Clients** (new + edit save) → **Projects**
 * (new + edit save) → **Tasks** (new task + edit save), end on task list.
 *
 * Run: `npm run test:e2e:journey`. Recording: `npm run test:e2e:ui:record` or `PLAYWRIGHT_SLOW_MO` /
 * `E2E_STEP_DELAY_MS`.
 */
test.describe('App journey', () => {
  test('sidebar → Clients → Projects → Tasks (create/edit save)', async ({
    page,
    request,
  }) => {
    await waitForApiHealthy(request)
    await loginAsDemo(page)
    await e2eStepPause()

    const main = page.getByRole('main')
    const suffix = `${Date.now()}-${test.info().parallelIndex}`
    const clientNew = `E2E Client ${suffix}`
    const clientEdited = `${clientNew} renamed`
    const projectNew = `E2E Project ${suffix}`
    const projectEdited = `${projectNew} renamed`

    const navPages = buildSidebarNavPagesInOrder()
    for (const item of navPages) {
      const label = item.testId.replace(/^sidebar-nav-/, '')
      await test.step(`Sidebar → ${label}`, async () => {
        const link = page.getByTestId(item.testId)
        await link.scrollIntoViewIfNeeded()
        await link.click()
        await expect(page).toHaveURL(item.url, { timeout: 25_000 })
        await expect(main).toBeVisible({ timeout: 30_000 })
        await expect(
          main.getByRole('heading', { level: 1, name: item.h1 }),
        ).toBeVisible({ timeout: 30_000 })
        if (item.listHint != null) {
          await expect(main.getByText(item.listHint).first()).toBeVisible({
            timeout: 20_000,
          })
        }
        await e2eStepPause()
      })
    }

    await test.step('Clients: new + save', async () => {
      await page.goto('/clients')
      await expect(page).toHaveURL(/\/clients\/?$/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Clients' }),
      ).toBeVisible({ timeout: 30_000 })

      await page.getByRole('link', { name: 'New client' }).click()
      await expect(page).toHaveURL(/\/clients\/new/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'New client' }),
      ).toBeVisible()

      await page.getByLabel('Client name').fill(clientNew)
      await page.getByRole('button', { name: 'Save client' }).click()
      await expect(page).toHaveURL(/\/clients\/?$/, { timeout: 25_000 })
      await expect(clientListRow(page, clientNew)).toBeVisible({
        timeout: 20_000,
      })
      await e2eStepPause()
    })

    await test.step('Clients: edit + save', async () => {
      await clientListRow(page, clientNew).getByRole('link', { name: 'Edit' }).click()
      await expect(page).toHaveURL(/\/clients\/[^/]+\/edit/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Edit client' }),
      ).toBeVisible({ timeout: 20_000 })

      await page.getByLabel('Client name').fill(clientEdited)
      await page.getByRole('button', { name: 'Save client' }).click()
      await expect(page).toHaveURL(/\/clients\/?$/, { timeout: 25_000 })
      await expect(clientListRow(page, clientEdited)).toBeVisible({
        timeout: 20_000,
      })
      await e2eStepPause()
    })

    await test.step('Projects: new + save', async () => {
      await page.goto('/projects/new')
      await expect(page).toHaveURL(/\/projects\/new/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'New project' }),
      ).toBeVisible({ timeout: 30_000 })

      await expect(
        page.locator('#proj-client').locator('option', { hasText: clientEdited }),
      ).toBeAttached({ timeout: 25_000 })
      await page.locator('#proj-client').selectOption({ label: clientEdited })

      await page.getByLabel('Project name').fill(projectNew)
      await page.getByRole('button', { name: 'Save project' }).click()
      await expect(page).toHaveURL(/\/projects\/?$/, { timeout: 25_000 })
      await expect(
        page.getByRole('heading', { level: 1, name: 'Projects' }),
      ).toBeVisible({ timeout: 20_000 })
      await expect(main.getByText(projectNew).first()).toBeVisible({
        timeout: 20_000,
      })
      await e2eStepPause()
    })

    await test.step('Projects: edit + save', async () => {
      const row = projectTableRow(page, projectNew)
      await row.getByRole('button', { name: 'Actions' }).click()
      await page.getByRole('menuitem', { name: 'Edit' }).click()
      await expect(page).toHaveURL(/\/projects\/[^/]+\/edit/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Edit project' }),
      ).toBeVisible({ timeout: 30_000 })

      await page.getByLabel('Project name').fill(projectEdited)
      await page.getByRole('button', { name: 'Save project' }).click()
      await expect(page).toHaveURL(/\/projects\/?$/, { timeout: 25_000 })
      await expect(main.getByText(projectEdited).first()).toBeVisible({
        timeout: 20_000,
      })
      await e2eStepPause()
    })

    await test.step('Sidebar → tasks (task flow)', async () => {
      await page.getByTestId('sidebar-nav-tasks').click()
      await expect(page).toHaveURL(/\/tasks\/?$/, { timeout: 20_000 })
      await expect(
        page.getByRole('heading', { level: 1, name: /^Tasks$/ }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(
        main.getByText(/Common tasks|Other tasks|New task/).first(),
      ).toBeVisible({ timeout: 15_000 })
      await e2eStepPause()
    })

    await test.step('Tasks: new + edit save', async () => {
      const base = `E2E journey ${suffix}`
      await page.getByRole('button', { name: 'New task' }).click()
      await page.getByLabel('Task name').fill(base)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByLabel('Task name')).not.toBeVisible({
        timeout: 20_000,
      })
      await expect(taskRow(page, base)).toBeVisible({ timeout: 20_000 })
      await e2eStepPause()

      await taskRow(page, base).getByRole('button', { name: 'Actions' }).click()
      await page.getByRole('menuitem', { name: 'Edit' }).click()
      await expect(page.getByLabel('Task name')).toBeVisible()
      await e2eStepPause()
      const renamed = `${base} ok`
      await page.getByLabel('Task name').fill(renamed)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByLabel('Task name')).not.toBeVisible({
        timeout: 20_000,
      })
      await expect(taskRow(page, renamed)).toBeVisible({ timeout: 20_000 })
      await expect(page).toHaveURL(/\/tasks\/?$/)
      await expect(
        page.getByRole('heading', { level: 1, name: /^Tasks$/ }),
      ).toBeVisible()
      await e2eStepPause()
    })
  })
})

import type { Page } from '@playwright/test'

/** A task row inside Common or Other lists (avoids matching unrelated `li` on the page). */
export function taskRow(page: Page, name: string) {
  return page
    .locator('[data-testid="task-list-common"], [data-testid="task-list-other"]')
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })
}

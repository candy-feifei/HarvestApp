import type { Page } from '@playwright/test'

/** Clients 列表：一行对应一个 `li`，内含客户名称与 Edit 链接 */
export function clientListRow(page: Page, clientName: string) {
  return page.locator('main ul').getByRole('listitem').filter({
    has: page.getByText(clientName, { exact: true }),
  })
}

/** Projects 表格数据行：包含项目名称 */
export function projectTableRow(page: Page, projectName: string) {
  return page.locator('tbody tr').filter({ hasText: projectName }).first()
}

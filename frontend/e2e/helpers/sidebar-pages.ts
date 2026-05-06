import { appFooterNavItems, appNavSections } from '../../src/lib/nav-config'

export type SidebarNavPageAssert = {
  testId: string
  url: RegExp
  h1: RegExp
  listHint?: RegExp | string
}

/**
 * Matches `app-sidebar`: top-to-bottom `appNavSections`, then `appFooterNavItems` (e.g. Settings).
 * Order mirrors the UI so we do not drift from `nav-config` by maintaining a duplicate list by hand.
 */
const ASSERT_BY_NAV_ID: Record<
  string,
  { url: RegExp; h1: RegExp; listHint?: RegExp | string }
> = {
  time: {
    url: /\/time\/?$/,
    h1: /^Timesheet$/,
    listHint: /Day and week grid entry/,
  },
  expenses: {
    url: /\/expenses\/?$/,
    h1: /^Expenses$/,
    listHint: /Track expense|Teammate:/,
  },
  team: {
    url: /\/team\/?$/,
    h1: /^Team$/,
    listHint: /Invite person|Members|Roles/,
  },
  clients: {
    url: /\/clients\/?$/,
    h1: /^Clients$/,
    listHint: /New client|Filter by client or contact/,
  },
  projects: {
    url: /\/projects\/?$/,
    h1: /^Projects$/,
    listHint: /New project|Search by project or client/,
  },
  tasks: {
    url: /\/tasks\/?$/,
    h1: /^Tasks$/,
    listHint: /Common tasks|Other tasks|New task/,
  },
  invoices: {
    url: /\/invoices\/?$/,
    h1: /^Invoices$/,
    listHint: 'Coming soon.',
  },
  estimates: {
    url: /\/estimates\/?$/,
    h1: /^Estimates$/,
    listHint: 'Coming soon.',
  },
  approvals: {
    url: /\/approvals\/?$/,
    h1: /^Approvals$/,
    listHint: /Time period|No rows for this view\.|Hours/,
  },
  reports: {
    url: /\/reports\/?$/,
    h1: /^Reports$/,
    listHint: /^Profitability$/,
  },
  settings: {
    url: /\/settings\/?$/,
    h1: /^Settings$/,
    listHint: 'Coming soon.',
  },
}

function assertMetaForNavId(id: string) {
  const meta = ASSERT_BY_NAV_ID[id]
  if (!meta) {
    throw new Error(
      `[e2e/helpers/sidebar-pages] Add url/h1/listHint for nav id "${id}" in ASSERT_BY_NAV_ID`,
    )
  }
  return meta
}

type BuildNavOptions = {
  /** Nav ids to skip on the first sidebar sweep (e.g. defer Tasks to a dedicated test). */
  skipNavIds?: readonly string[]
}

/** Same order as the sidebar: Track → Organize → Bill → Review → (footer) Settings */
export function buildSidebarNavPagesInOrder(
  options: BuildNavOptions = {},
): SidebarNavPageAssert[] {
  const skip = new Set(options.skipNavIds ?? [])
  const out: SidebarNavPageAssert[] = []
  for (const section of appNavSections) {
    for (const item of section.items) {
      if (skip.has(item.id)) continue
      const m = assertMetaForNavId(item.id)
      out.push({ testId: `sidebar-nav-${item.id}`, ...m })
    }
  }
  for (const item of appFooterNavItems) {
    if (skip.has(item.id)) continue
    const m = assertMetaForNavId(item.id)
    out.push({ testId: `sidebar-nav-${item.id}`, ...m })
  }
  return out
}

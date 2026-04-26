import { BadRequestException, Injectable } from '@nestjs/common'
import { BillingMethod, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import type { ProfitabilityReportQueryDto } from './dto/profitability-report.query.dto'
import type { TimeReportQueryDto } from './dto/time-report.query.dto'

function toNum(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0
  return d.toNumber()
}

function parseIdList(s: string | undefined): string[] {
  if (!s || !s.trim()) return []
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function utcYmdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((p) => parseInt(p, 10))
  if (Number.isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31) {
    throw new BadRequestException('Invalid date in range')
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

type TimeEntryForReport = {
  id: string
  userId: string
  projectId: string
  spentDate: Date
  hours: Prisma.Decimal
  user: { id: string; firstName: string; lastName: string; email: string }
  project: {
    id: string
    name: string
    isBillable: boolean
    isArchived: boolean
    billingMethod: BillingMethod
    hourlyRate: Prisma.Decimal | null
    clientId: string
    client: { id: string; name: string }
    assignments: { userId: string; isManager: boolean; projectBillableRate: Prisma.Decimal | null }[]
  }
  projectTask: {
    isBillable: boolean
    hourlyRate: Prisma.Decimal | null
    task: { id: string; name: string }
  }
}

type UserRateBundle = {
  userId: string
  weeklyCapacity: number
  rateHistories: { startDate: Date; endDate: Date | null; billableRate: Prisma.Decimal }[]
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private rangeFromDto(fromYmd: string, toYmd: string): { gte: Date; lte: Date } {
    const gte = utcYmdToDate(fromYmd)
    const lte = utcYmdToDate(toYmd)
    if (gte > lte) {
      throw new BadRequestException('The start date must be before the end date')
    }
    return { gte, lte }
  }

  private hoursBillable(
    t: { project: { isBillable: boolean }; projectTask: { isBillable: boolean } },
  ): number {
    if (t.project.isBillable && t.projectTask.isBillable) {
      return 1
    }
    return 0
  }

  private findAssignment(
    t: TimeEntryForReport,
  ): { userId: string; projectBillableRate: Prisma.Decimal | null } | undefined {
    return t.project.assignments.find((a) => a.userId === t.userId)
  }

  private rateFromHistory(
    userBundle: UserRateBundle | undefined,
    spent: Date,
  ): number | null {
    if (!userBundle || !userBundle.rateHistories.length) return null
    const t = spent.getTime()
    const rows = userBundle.rateHistories.filter((r) => {
      const a = r.startDate.getTime() <= t
      const b = r.endDate == null || t <= r.endDate.getTime()
      return a && b
    })
    if (rows.length === 0) {
      return null
    }
    const picked = rows.sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime(),
    )[0]
    return toNum(picked.billableRate)
  }

  private resolveRevenuePerHour(
    t: TimeEntryForReport,
    userBundle: UserRateBundle | undefined,
    spent: Date,
  ): { perHour: number; missing: boolean } {
    if (!t.project.isBillable || !t.projectTask.isBillable) {
      return { perHour: 0, missing: false }
    }
    if (t.project.billingMethod === 'NON_BILLABLE') {
      return { perHour: 0, missing: false }
    }
    const pt = toNum(t.projectTask.hourlyRate)
    if (pt > 0) {
      return { perHour: pt, missing: false }
    }
    const ph = toNum(t.project.hourlyRate)
    if (ph > 0) {
      return { perHour: ph, missing: false }
    }
    const assign = this.findAssignment(t)
    const ab = toNum(assign?.projectBillableRate)
    if (ab > 0) {
      return { perHour: ab, missing: false }
    }
    const fromHist = this.rateFromHistory(userBundle, spent)
    if (fromHist != null && fromHist > 0) {
      return { perHour: fromHist, missing: false }
    }
    if (t.project.billingMethod === 'FIXED_FEE' && toNum(t.project.hourlyRate) === 0) {
      return { perHour: 0, missing: toNum(t.hours) * this.hoursBillable(t) > 0 }
    }
    if (t.project.billingMethod === 'TM') {
      return { perHour: 0, missing: toNum(t.hours) * this.hoursBillable(t) > 0 }
    }
    return { perHour: 0, missing: false }
  }

  private calendarDaysInRange(gte: Date, lte: Date): number {
    const ms = lte.getTime() - gte.getTime()
    return Math.floor(ms / 86_400_000) + 1
  }

  private weeksInRangeForUtil(gte: Date, lte: Date): number {
    const d = this.calendarDaysInRange(gte, lte)
    return Math.max(1, d / 7)
  }

  async getReportFilters(m: ActiveMembership) {
    const orgId = m.organizationId
    const [clients, members, projectRows, tasks] = await Promise.all([
      this.prisma.client.findMany({
        where: { organizationId: orgId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.userOrganization.findMany({
        where: { organizationId: orgId, status: 'ACTIVE' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
      this.prisma.project.findMany({
        where: { organizationId: orgId, isArchived: false },
        select: {
          id: true,
          name: true,
          billingMethod: true,
          isArchived: true,
          clientId: true,
          client: { select: { name: true } },
          assignments: { where: { isManager: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { organizationId: orgId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])
    return {
      currency: m.organization.defaultCurrency,
      clients,
      team: members.map((r) => ({
        userId: r.userId,
        label: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email,
        email: r.user.email,
      })),
      projects: projectRows.map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        clientName: p.client.name,
        billingMethod: p.billingMethod,
        isArchived: p.isArchived,
        hasManager: p.assignments.length > 0,
      })),
      tasks,
      projectManagers: members
        .filter(
          (row) =>
            projectRows.some((p) => p.assignments.some((a) => a.userId === row.userId)),
        )
        .map((r) => ({
          userId: r.userId,
          label: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email,
        })),
    }
  }

  private projectWhereForProfitability(
    m: ActiveMembership,
    projectStatuses: string | undefined,
    projectTypes: string | undefined,
    projectManagerUserIds: string,
  ): Prisma.ProjectWhereInput {
    const orgId = m.organizationId
    const statuses = parseIdList(projectStatuses) as string[]
    const types = parseIdList(projectTypes) as BillingMethod[]
    const managerIds = parseIdList(projectManagerUserIds)
    const and: Prisma.ProjectWhereInput[] = [{ organizationId: orgId }]

    if (statuses.length) {
      const hasActive = statuses.includes('active')
      const hasArchived = statuses.includes('archived')
      if (hasActive && !hasArchived) {
        and.push({ isArchived: false })
      } else if (hasArchived && !hasActive) {
        and.push({ isArchived: true })
      }
    }

    if (types.length) {
      const valid = types.filter((x): x is BillingMethod =>
        (['TM', 'FIXED_FEE', 'NON_BILLABLE'] as const).includes(x as BillingMethod),
      )
      if (valid.length) {
        and.push({ billingMethod: { in: valid } })
      }
    }

    if (managerIds.length) {
      and.push({
        assignments: {
          some: { isManager: true, userId: { in: managerIds } },
        },
      })
    }
    return { AND: and }
  }

  async getTimeReport(m: ActiveMembership, q: TimeReportQueryDto) {
    const { gte, lte } = this.rangeFromDto(q.fromYmd, q.toYmd)
    const orgId = m.organizationId
    const groupBy = q.groupBy
    const clientIds = parseIdList(q.clientIds)
    const projectIds = parseIdList(q.projectIds)
    const userIds = parseIdList(q.userIds)
    const taskIds = parseIdList(q.taskIds)

    const and: Prisma.TimeEntryWhereInput[] = [
      { project: { organizationId: orgId } },
      { spentDate: { gte, lte } },
    ]
    if (q.activeProjectsOnly) {
      and.push({ project: { isArchived: false } })
    }
    if (clientIds.length) {
      and.push({ project: { clientId: { in: clientIds } } })
    }
    if (projectIds.length) {
      and.push({ projectId: { in: projectIds } })
    }
    if (userIds.length) {
      and.push({ userId: { in: userIds } })
    }
    if (taskIds.length) {
      and.push({ projectTask: { taskId: { in: taskIds } } })
    }

    const timeEntries = (await this.prisma.timeEntry.findMany({
      where: { AND: and },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          include: {
            client: { select: { id: true, name: true } },
            assignments: {
              select: {
                userId: true,
                isManager: true,
                projectBillableRate: true,
              },
            },
          },
        },
        projectTask: { include: { task: { select: { id: true, name: true } } } },
      },
    })) as TimeEntryForReport[]

    const userSet = new Set<string>()
    for (const t of timeEntries) {
      userSet.add(t.userId)
    }
    const uoRows = await this.prisma.userOrganization.findMany({
      where: {
        organizationId: orgId,
        userId: { in: [...userSet] },
        status: 'ACTIVE',
      },
      include: {
        rateHistories: { orderBy: { startDate: 'desc' } },
      },
    })
    const userBundle = new Map<string, UserRateBundle>()
    for (const r of uoRows) {
      userBundle.set(r.userId, {
        userId: r.userId,
        weeklyCapacity: r.weeklyCapacity,
        rateHistories: r.rateHistories.map((h) => ({
          startDate: h.startDate,
          endDate: h.endDate,
          billableRate: h.billableRate,
        })),
      })
    }

    let totalHours = 0
    let billableHours = 0
    let nonBillableHours = 0
    let billableAmount = 0
    let hasMissingRate = false

    type Acc = {
      id: string
      label: string
      subLabel: string | null
      clientId: string | null
      clientName: string | null
      projectId: string | null
      userId: string | null
      taskId: string | null
      hours: number
      billH: number
      billAmt: number
      hasMissing: boolean
    }
    const map = new Map<string, Acc>()

    const keyFor = (t: TimeEntryForReport): { key: string; seed: Acc } | null => {
      const cname = t.project.client.name
      if (groupBy === 'clients') {
        return {
          key: `c:${t.project.clientId}`,
          seed: {
            id: t.project.clientId,
            label: cname,
            subLabel: null,
            clientId: t.project.clientId,
            clientName: cname,
            projectId: null,
            userId: null,
            taskId: null,
            hours: 0,
            billH: 0,
            billAmt: 0,
            hasMissing: false,
          },
        }
      }
      if (groupBy === 'projects') {
        return {
          key: `p:${t.projectId}`,
          seed: {
            id: t.projectId,
            label: t.project.name,
            subLabel: cname,
            clientId: t.project.clientId,
            clientName: cname,
            projectId: t.projectId,
            userId: null,
            taskId: null,
            hours: 0,
            billH: 0,
            billAmt: 0,
            hasMissing: false,
          },
        }
      }
      if (groupBy === 'tasks') {
        return {
          key: `k:${t.projectTask.task.id}`,
          seed: {
            id: t.projectTask.task.id,
            label: t.projectTask.task.name,
            subLabel: null,
            clientId: t.project.clientId,
            clientName: cname,
            projectId: t.projectId,
            userId: null,
            taskId: t.projectTask.task.id,
            hours: 0,
            billH: 0,
            billAmt: 0,
            hasMissing: false,
          },
        }
      }
      return {
        key: `u:${t.userId}`,
        seed: {
          id: t.userId,
          label: `${t.user.firstName} ${t.user.lastName}`.trim() || t.user.email,
          subLabel: null,
          clientId: null,
          clientName: null,
          projectId: null,
          userId: t.userId,
          taskId: null,
          hours: 0,
          billH: 0,
          billAmt: 0,
          hasMissing: false,
        },
      }
    }

    for (const t of timeEntries) {
      const h = toNum(t.hours)
      const bFactor = this.hoursBillable(t)
      const bh = h * bFactor
      const { perHour, missing } = this.resolveRevenuePerHour(
        t,
        userBundle.get(t.userId),
        t.spentDate,
      )
      const bAmt = bh * perHour
      if (missing) hasMissingRate = true

      totalHours += h
      if (bFactor) {
        billableHours += h
        billableAmount += bAmt
      } else {
        nonBillableHours += h
      }

      const g = keyFor(t)
      if (!g) continue
      if (!map.has(g.key)) {
        map.set(g.key, { ...g.seed })
      }
      const row = map.get(g.key)!
      row.hours += h
      row.billH += bh
      row.billAmt += bAmt
      if (missing) row.hasMissing = true
    }

    const weeks = this.weeksInRangeForUtil(gte, lte)
    const rows: Array<{
      id: string
      name: string
      clientName: string | null
      hours: number
      hourShare: number
      billableHours: number
      billableHoursOfTotalPct: number
      billableAmount: number
      utilizationPercent: number | null
    }> = []
    const sorted = [...map.values()].sort((a, b) => b.hours - a.hours)
    for (const r of sorted) {
      let util: number | null = null
      if (groupBy === 'team' && r.userId) {
        const cap = userBundle.get(r.userId)
        if (cap && cap.weeklyCapacity > 0) {
          const capH = (cap.weeklyCapacity / 40) * 40 * weeks
          util = capH > 0 ? Math.min(100, (r.hours / capH) * 100) : 0
        } else {
          util = 0
        }
      }
      const billPct =
        r.hours > 0 ? Math.min(100, (r.billH / r.hours) * 100) : 0
      rows.push({
        id: r.id,
        name: r.label,
        clientName:
          groupBy === 'projects' || groupBy === 'tasks' ? r.clientName : null,
        hours: Math.round(r.hours * 100) / 100,
        hourShare: 0,
        billableHours: Math.round(r.billH * 100) / 100,
        billableHoursOfTotalPct: Math.round(billPct * 10) / 10,
        billableAmount: Math.round(r.billAmt * 100) / 100,
        utilizationPercent: util,
      })
    }
    const maxH = rows.reduce((m, x) => Math.max(m, x.hours), 0)
    for (const r of rows) {
      r.hourShare = maxH > 0 ? r.hours / maxH : 0
    }

    const th = Math.round(totalHours * 100) / 100
    const tbh = Math.round(billableHours * 100) / 100
    const tnb = Math.max(0, Math.round((totalHours - billableHours) * 100) / 100)
    const billablePct = th > 0 ? (tbh / th) * 100 : 0
    return {
      range: { fromYmd: q.fromYmd, toYmd: q.toYmd, currency: m.organization.defaultCurrency },
      summary: {
        totalHours: th,
        billableHours: tbh,
        nonBillableHours: tnb,
        billableOfTotalPct: Math.round(billablePct * 10) / 10,
        billableAmount: Math.round(billableAmount * 100) / 100,
        uninvoicedAmount: Math.round(billableAmount * 100) / 100,
        invoicedAmount: 0,
        hasMissingRate,
      },
      groupBy,
      rows,
      totals: {
        hours: rows.reduce((s, x) => s + x.hours, 0),
        billableHours: rows.reduce((s, x) => s + x.billableHours, 0),
        billableAmount: rows.reduce((s, x) => s + x.billableAmount, 0),
      },
    }
  }

  async getProfitabilityReport(m: ActiveMembership, q: ProfitabilityReportQueryDto) {
    const { gte, lte } = this.rangeFromDto(q.fromYmd, q.toYmd)
    const orgId = m.organizationId
    const groupBy = q.groupBy

    const pWhere = this.projectWhereForProfitability(
      m,
      q.projectStatuses,
      q.projectTypes,
      q.projectManagerUserIds ?? '',
    )
    const allowedProjects = await this.prisma.project.findMany({
      where: pWhere,
      select: { id: true },
    })
    const projectIdSet = new Set(allowedProjects.map((p) => p.id))

    const andT: Prisma.TimeEntryWhereInput[] = [
      { project: { organizationId: orgId } },
      { spentDate: { gte, lte } },
      { projectId: { in: [...projectIdSet] } },
    ]

    const andE: Prisma.ExpenseWhereInput[] = [
      { project: { organizationId: orgId } },
      { spentDate: { gte, lte } },
      { projectId: { in: [...projectIdSet] } },
    ]

    const [timeEntries, expenses, uoRows] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { AND: andT },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          project: {
            include: {
              client: { select: { id: true, name: true } },
              assignments: {
                select: {
                  userId: true,
                  isManager: true,
                  projectBillableRate: true,
                },
              },
            },
          },
          projectTask: { include: { task: { select: { id: true, name: true } } } },
        },
      }) as Promise<TimeEntryForReport[]>,
      this.prisma.expense.findMany({
        where: { AND: andE },
        include: {
          project: { include: { client: { select: { id: true, name: true } } } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.userOrganization.findMany({
        where: { organizationId: orgId, status: 'ACTIVE' },
        include: { rateHistories: { orderBy: { startDate: 'desc' } } },
      }),
    ])

    const userBundle = new Map<string, UserRateBundle>()
    for (const r of uoRows) {
      userBundle.set(r.userId, {
        userId: r.userId,
        weeklyCapacity: r.weeklyCapacity,
        rateHistories: r.rateHistories.map((h) => ({
          startDate: h.startDate,
          endDate: h.endDate,
          billableRate: h.billableRate,
        })),
      })
    }

    const revenueByMonth = new Map<string, number>()
    const costByMonth = new Map<string, number>()
    const setMonth = (d: Date) => {
      const y = d.getUTCFullYear()
      const mo = d.getUTCMonth() + 1
      return `${y}-${String(mo).padStart(2, '0')}`
    }
    for (const t of timeEntries) {
      const mkey = setMonth(t.spentDate)
      const h = toNum(t.hours)
      const bFactor = this.hoursBillable(t)
      const bh = h * bFactor
      const { perHour, missing: _m } = this.resolveRevenuePerHour(
        t,
        userBundle.get(t.userId),
        t.spentDate,
      )
      const rev = bh * perHour
      revenueByMonth.set(mkey, (revenueByMonth.get(mkey) ?? 0) + rev)
    }
    for (const e of expenses) {
      const mkey = setMonth(e.spentDate)
      const a = toNum(e.amount)
      costByMonth.set(mkey, (costByMonth.get(mkey) ?? 0) + a)
    }

    let totalRevenue = 0
    let totalExpenses = 0
    let hasMissing = false
    for (const t of timeEntries) {
      const h = toNum(t.hours)
      const bFactor = this.hoursBillable(t)
      const bh = h * bFactor
      const { perHour, missing } = this.resolveRevenuePerHour(
        t,
        userBundle.get(t.userId),
        t.spentDate,
      )
      if (missing) hasMissing = true
      totalRevenue += bh * perHour
    }
    for (const e of expenses) {
      totalExpenses += toNum(e.amount)
    }
    const totalProfit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    const monthKeys: string[] = []
    {
      const cur = new Date(
        Date.UTC(
          gte.getUTCFullYear(),
          gte.getUTCMonth(),
          1,
          0,
          0,
          0,
          0,
        ),
      )
      const endM = new Date(
        Date.UTC(
          lte.getUTCFullYear(),
          lte.getUTCMonth(),
          1,
          0,
          0,
          0,
          0,
        ),
      )
      for (; cur.getTime() <= endM.getTime(); ) {
        const y = cur.getUTCFullYear()
        const mo = cur.getUTCMonth() + 1
        monthKeys.push(`${y}-${String(mo).padStart(2, '0')}`)
        cur.setUTCMonth(cur.getUTCMonth() + 1)
      }
    }

    const series = monthKeys.map((k) => {
      const r = Math.round((revenueByMonth.get(k) ?? 0) * 100) / 100
      const c = Math.round((costByMonth.get(k) ?? 0) * 100) / 100
      return {
        month: k,
        label: (() => {
          const [yy, mm] = k.split('-')
          return new Date(
            Date.UTC(parseInt(yy, 10), parseInt(mm, 10) - 1, 1),
          ).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
        })(),
        revenue: r,
        costs: c,
        profit: Math.round((r - c) * 100) / 100,
      }
    })

    type PAcc = {
      id: string
      label: string
      sub: string | null
      cname: string | null
      projectId: string | null
      userId: string | null
      taskId: string | null
      rev: number
      cost: number
      hasMissing: boolean
    }
    const pmap = new Map<string, PAcc>()

    const pkey = (t: TimeEntryForReport) => {
      if (groupBy === 'clients') {
        return {
          k: `c:${t.project.clientId}`,
          seed: {
            id: t.project.clientId,
            label: t.project.client.name,
            sub: null,
            cname: t.project.client.name,
            projectId: null,
            userId: null,
            taskId: null,
            rev: 0,
            cost: 0,
            hasMissing: false,
          } as PAcc,
        }
      }
      if (groupBy === 'projects') {
        return {
          k: `p:${t.projectId}`,
          seed: {
            id: t.projectId,
            label: t.project.name,
            sub: t.project.client.name,
            cname: t.project.client.name,
            projectId: t.projectId,
            userId: null,
            taskId: null,
            rev: 0,
            cost: 0,
            hasMissing: false,
          },
        }
      }
      if (groupBy === 'tasks') {
        return {
          k: `k:${t.projectTask.task.id}`,
          seed: {
            id: t.projectTask.task.id,
            label: t.projectTask.task.name,
            sub: t.project.name,
            cname: t.project.client.name,
            projectId: t.projectId,
            userId: null,
            taskId: t.projectTask.task.id,
            rev: 0,
            cost: 0,
            hasMissing: false,
          },
        }
      }
      return {
        k: `u:${t.userId}`,
        seed: {
          id: t.userId,
          label: `${t.user.firstName} ${t.user.lastName}`.trim() || t.user.email,
          sub: null,
          cname: null,
          projectId: null,
          userId: t.userId,
          taskId: null,
          rev: 0,
          cost: 0,
          hasMissing: false,
        },
      }
    }
    for (const t of timeEntries) {
      const h = toNum(t.hours)
      const bFactor = this.hoursBillable(t)
      const bh = h * bFactor
      const { perHour, missing } = this.resolveRevenuePerHour(
        t,
        userBundle.get(t.userId),
        t.spentDate,
      )
      const rev = bh * perHour
      const o = pkey(t)
      if (!pmap.has(o.k)) pmap.set(o.k, { ...o.seed })
      const a = pmap.get(o.k)!
      a.rev += rev
      if (missing) a.hasMissing = true
    }

    const expenseProjectIds = [...new Set(expenses.map((e) => e.projectId))]
    const projectTaskRows = expenseProjectIds.length
      ? await this.prisma.projectTask.findMany({
          where: { projectId: { in: expenseProjectIds } },
          include: { task: { select: { id: true, name: true } } },
        })
      : []
    const projectTasksByProject = new Map<string, typeof projectTaskRows>()
    for (const row of projectTaskRows) {
      if (!projectTasksByProject.has(row.projectId)) {
        projectTasksByProject.set(row.projectId, [])
      }
      projectTasksByProject.get(row.projectId)!.push(row)
    }

    for (const e of expenses) {
      const t = e.project
      const amt = toNum(e.amount)
      if (groupBy === 'clients') {
        const k = `c:${t.clientId}`
        if (!pmap.has(k)) {
          pmap.set(k, {
            id: t.clientId,
            label: t.client.name,
            sub: null,
            cname: t.client.name,
            projectId: null,
            userId: null,
            taskId: null,
            rev: 0,
            cost: 0,
            hasMissing: false,
          })
        }
        pmap.get(k)!.cost += amt
      } else if (groupBy === 'projects') {
        const k = `p:${e.projectId}`
        if (!pmap.has(k)) {
          pmap.set(k, {
            id: e.projectId,
            label: t.name,
            sub: t.client.name,
            cname: t.client.name,
            projectId: e.projectId,
            userId: null,
            taskId: null,
            rev: 0,
            cost: 0,
            hasMissing: false,
          })
        }
        pmap.get(k)!.cost += amt
      } else if (groupBy === 'team') {
        const k = `u:${e.userId}`
        if (!pmap.has(k)) {
          const u = e.user
          pmap.set(k, {
            id: e.userId,
            label: `${u.firstName} ${u.lastName}`.trim() || u.email,
            sub: null,
            cname: null,
            projectId: null,
            userId: e.userId,
            taskId: null,
            rev: 0,
            cost: 0,
            hasMissing: false,
          })
        }
        pmap.get(k)!.cost += amt
      } else if (groupBy === 'tasks') {
        const pts = projectTasksByProject.get(e.projectId) ?? []
        if (pts.length === 0) {
          const k = `pe:${e.projectId}`
          if (!pmap.has(k)) {
            pmap.set(k, {
              id: k,
              label: 'Project (no tasks) expenses',
              sub: t.name,
              cname: t.client.name,
              projectId: e.projectId,
              userId: null,
              taskId: null,
              rev: 0,
              cost: 0,
              hasMissing: false,
            })
          }
          pmap.get(k)!.cost += amt
        } else {
          const share = 1 / pts.length
          for (const pt of pts) {
            const k = `k:${pt.taskId}`
            if (!pmap.has(k)) {
              pmap.set(k, {
                id: pt.taskId,
                label: pt.task.name,
                sub: t.name,
                cname: t.client.name,
                projectId: e.projectId,
                userId: null,
                taskId: pt.taskId,
                rev: 0,
                cost: 0,
                hasMissing: false,
              })
            }
            pmap.get(k)!.cost += amt * share
          }
        }
      }
    }

    const prows = [...pmap.values()]
      .map((a) => {
        const pro = a.rev - a.cost
        const roc = a.cost > 0 ? (pro / a.cost) * 100 : null
        return {
          id: a.id,
          name: a.label,
          clientName: a.cname,
          subLabel: a.sub,
          revenue: Math.round(a.rev * 100) / 100,
          cost: Math.round(a.cost * 100) / 100,
          profit: Math.round(pro * 100) / 100,
          returnOnCostPercent: roc == null ? null : Math.round(roc * 10) / 10,
          hasMissingRate: a.hasMissing,
        }
      })
      .sort(
        (a, b) =>
          Math.abs(b.revenue) + Math.abs(b.profit) - (Math.abs(a.revenue) + Math.abs(a.profit)),
      )

    const pmax = prows.reduce((m, r) => Math.max(m, Math.abs(r.profit)), 0)

    return {
      range: {
        fromYmd: q.fromYmd,
        toYmd: q.toYmd,
        currency: q.currency?.trim() || m.organization.defaultCurrency,
      },
      hasMissingRate: hasMissing,
      series,
      summary: {
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          invoiced: 0,
          uninvoiced: Math.round(totalRevenue * 100) / 100,
        },
        costs: {
          total: Math.round(totalExpenses * 100) / 100,
          fromTime: 0,
          fromExpenses: Math.round(totalExpenses * 100) / 100,
        },
        profit: {
          amount: Math.round(totalProfit * 100) / 100,
          marginPercent: Math.round(margin * 10) / 10,
        },
      },
      groupBy,
      rows: prows.map((r) => ({
        ...r,
        profitBarShare: pmax > 0 ? Math.min(1, Math.abs(r.profit) / pmax) : 0,
        marginPercent:
          r.revenue > 0 ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0,
      })),
      totals: {
        revenue: prows.reduce((s, r) => s + r.revenue, 0),
        cost: prows.reduce((s, r) => s + r.cost, 0),
        profit: prows.reduce((s, r) => s + r.profit, 0),
      },
    }
  }
}

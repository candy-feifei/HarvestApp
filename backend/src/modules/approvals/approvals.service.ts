import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { EntryStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import {
  parseUuidList,
  type ApprovalsViewQueryDto,
} from './dto/approvals-view-query.dto'

const APPROVE_ROLES = new Set(['ADMINISTRATOR', 'MANAGER'])

type EntryStatusFilter = EntryStatus | 'ALL'

type TRow = {
  timeEntry: {
    id: string
    userId: string
    projectId: string
    status: EntryStatus
    isLocked: boolean
    hours: Prisma.Decimal
    project: {
      id: string
      name: string
      isBillable: boolean
      clientId: string
      client: { id: string; name: string }
    }
    projectTask: { isBillable: boolean }
    user: { id: string; firstName: string; lastName: string; email: string }
  }
}

type ERow = {
  expense: {
    id: string
    userId: string
    projectId: string
    status: EntryStatus
    isLocked: boolean
    amount: Prisma.Decimal
    project: {
      id: string
      name: string
      isBillable: boolean
      clientId: string
      client: { id: string; name: string }
    }
    user: { id: string; firstName: string; lastName: string; email: string }
  }
}

type GroupAcc = {
  groupId: string
  lineLabel: string
  lineSub: string | null
  timeEntryIds: string[]
  expenseIds: string[]
  hours: number
  billableHours: number
  billableExpense: number
  nonBillableExpense: number
  isFullyLockedApproved: boolean
  hasApprovableSubmitted: boolean
  hasLockedApproved: boolean
  rowUser: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  rowProject: { id: string; name: string } | null
  rowClient: { id: string; name: string } | null
  teCount: number
  expCount: number
}

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  requireApprover(m: ActiveMembership) {
    if (!APPROVE_ROLES.has(m.systemRole)) {
      throw new ForbiddenException(
        'Administrator or manager role is required to review approvals',
      )
    }
  }

  private parseDateRange(from: string, to: string): { gte: Date; lte: Date } {
    const gte = new Date(from)
    const lte = new Date(to)
    if (Number.isNaN(gte.getTime()) || Number.isNaN(lte.getTime())) {
      throw new BadRequestException('Invalid date range')
    }
    if (gte > lte) {
      throw new BadRequestException('The start date must be before the end date')
    }
    return { gte, lte }
  }

  private buildTimeWhere(
    orgId: string,
    gte: Date,
    lte: Date,
    entryStatus: EntryStatusFilter,
    clientIds: string[],
    projectIds: string[],
    roleIds: string[],
    userIds: string[],
    /** 仅 getView 使用：Pending 视图中除 SUBMITTED 外，也包含与 WITHDRAWN 周期相关的 UNSUBMITTED 行。approve/按组加载不传此参数。 */
    viewOpts?: { pendingIncludesUnsubmittedForWithdrawnSubmitters?: string[] },
  ): Prisma.TimeEntryWhereInput {
    const and: Prisma.TimeEntryWhereInput[] = [
      { project: { organizationId: orgId } },
      { spentDate: { gte, lte } },
    ]
    if (entryStatus === 'APPROVED') {
      and.push({ status: 'APPROVED' as EntryStatus })
    } else if (entryStatus === 'SUBMITTED') {
      const w = viewOpts?.pendingIncludesUnsubmittedForWithdrawnSubmitters
      if (w != null && w.length > 0) {
        and.push({
          OR: [
            { status: 'SUBMITTED' as EntryStatus },
            {
              status: 'UNSUBMITTED' as EntryStatus,
              userId: { in: w },
            },
          ],
        })
      } else {
        and.push({ status: 'SUBMITTED' as EntryStatus })
      }
    } else if (entryStatus === 'UNSUBMITTED') {
      and.push({ status: 'UNSUBMITTED' as EntryStatus })
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
    if (roleIds.length) {
      and.push({
        user: {
          organizations: {
            some: {
              organizationId: orgId,
              status: 'ACTIVE',
              customRoles: { some: { id: { in: roleIds } } },
            },
          },
        },
      })
    }
    return { AND: and }
  }

  private timeWhereWithGroup(
    m: ActiveMembership,
    gte: Date,
    lte: Date,
    entryStatus: EntryStatusFilter,
    clientIds: string[],
    projectIds: string[],
    roleIds: string[],
    userIds: string[],
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    groupId: string,
  ) {
    const base = this.buildTimeWhere(
      m.organizationId,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
    )
    const and = [...(base.AND as Prisma.TimeEntryWhereInput[])]
    if (groupBy === 'PERSON') {
      and.push({ userId: groupId })
    } else if (groupBy === 'PROJECT') {
      and.push({ projectId: groupId })
    } else {
      and.push({ project: { clientId: groupId } })
    }
    return { AND: and } as Prisma.TimeEntryWhereInput
  }

  private expenseWhereWithGroup(
    m: ActiveMembership,
    gte: Date,
    lte: Date,
    entryStatus: EntryStatusFilter,
    clientIds: string[],
    projectIds: string[],
    roleIds: string[],
    userIds: string[],
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    groupId: string,
  ) {
    return this.timeWhereWithGroup(
      m,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
      groupBy,
      groupId,
    ) as Prisma.ExpenseWhereInput
  }

  private buildExpenseWhere(
    orgId: string,
    gte: Date,
    lte: Date,
    entryStatus: EntryStatusFilter,
    clientIds: string[],
    projectIds: string[],
    roleIds: string[],
    userIds: string[],
    viewOpts?: { pendingIncludesUnsubmittedForWithdrawnSubmitters?: string[] },
  ): Prisma.ExpenseWhereInput {
    return this.buildTimeWhere(
      orgId,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
      viewOpts,
    ) as Prisma.ExpenseWhereInput
  }

  /**
   * 与报表 [gte, lte] 有交集、且 status=WITHDRAWN 的提交人（本组织成员），
   * 供「Pending approval」筛选项在 SUBMITTED 之外附带展示其被撤回后未再提交的行。
   */
  private async submitterIdsWithWithdrawnApprovalsInRange(
    m: ActiveMembership,
    gte: Date,
    lte: Date,
  ) {
    const rows = await this.prisma.approval.findMany({
      where: {
        status: 'WITHDRAWN',
        periodStart: { lte: lte },
        periodEnd: { gte: gte },
        submitter: {
          organizations: {
            some: { organizationId: m.organizationId, status: 'ACTIVE' },
          },
        },
      },
      select: { submitterId: true },
      distinct: ['submitterId'],
    })
    return rows.map((r) => r.submitterId)
  }

  private pickEntryStatus(s: string | undefined): EntryStatusFilter {
    if (s == null) {
      return 'SUBMITTED'
    }
    if (s === 'ALL') {
      return 'ALL'
    }
    if (s === 'APPROVED' || s === 'SUBMITTED' || s === 'UNSUBMITTED') {
      return s
    }
    return 'SUBMITTED'
  }

  private parseIdLists(dto: ApprovalsViewQueryDto) {
    const a = parseUuidList('clientIds', dto.clientIds)
    const b = parseUuidList('projectIds', dto.projectIds)
    const c = parseUuidList('roleIds', dto.roleIds)
    const d = parseUuidList('userIds', dto.userIds)
    if (!a.ok) {
      throw new BadRequestException(a.message)
    }
    if (!b.ok) {
      throw new BadRequestException(b.message)
    }
    if (!c.ok) {
      throw new BadRequestException(c.message)
    }
    if (!d.ok) {
      throw new BadRequestException(d.message)
    }
    return { clientIds: a.ids, projectIds: b.ids, roleIds: c.ids, userIds: d.ids }
  }

  listFilters(m: ActiveMembership) {
    this.requireApprover(m)
    const orgId = m.organizationId
    return Promise.all([
      this.prisma.client.findMany({
        where: { organizationId: orgId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.project.findMany({
        where: { organizationId: orgId, isArchived: false },
        select: { id: true, name: true, client: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.role.findMany({
        where: { organizationId: orgId },
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
    ]).then(([clients, projects, roles, members]) => ({
      clients: clients.map((x) => ({ id: x.id, name: x.name })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.client.id,
        clientName: p.client.name,
      })),
      roles: roles.map((r) => ({ id: r.id, name: r.name })),
      teammates: members.map((r) => ({
        userId: r.userId,
        memberId: r.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        label: `${r.user.firstName} ${r.user.lastName}`.trim(),
      })),
    }))
  }

  getMeta() {
    return {
      reportPeriods: [
        'DAY',
        'WEEK',
        'SEMIMONTH',
        'MONTH',
        'QUARTER',
        'CUSTOM',
      ],
      groupBy: ['PERSON', 'PROJECT', 'CLIENT'],
      entryStatus: ['UNSUBMITTED', 'SUBMITTED', 'APPROVED', 'ALL'],
    }
  }

  private hoursBillable(t: TRow['timeEntry']): number {
    const h = Number(t.hours)
    if (t.project.isBillable && t.projectTask.isBillable) {
      return h
    }
    return 0
  }

  private groupIdFor(
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    t: TRow['timeEntry'] | ERow['expense'],
  ) {
    if (groupBy === 'PERSON') {
      return t.userId
    }
    if (groupBy === 'PROJECT') {
      return t.projectId
    }
    return t.project.clientId
  }

  private newGroup(groupBy: 'PERSON' | 'PROJECT' | 'CLIENT', t: TRow['timeEntry']): GroupAcc {
    return {
      groupId: this.groupIdFor(groupBy, t),
      lineLabel: this.lineLabel(groupBy, t),
      lineSub: this.lineSub(groupBy, t),
      timeEntryIds: [],
      expenseIds: [],
      hours: 0,
      billableHours: 0,
      billableExpense: 0,
      nonBillableExpense: 0,
      isFullyLockedApproved: true,
      hasApprovableSubmitted: false,
      hasLockedApproved: false,
      rowUser:
        groupBy === 'PERSON'
          ? {
              id: t.userId,
              firstName: t.user.firstName,
              lastName: t.user.lastName,
              email: t.user.email,
            }
          : null,
      rowProject: groupBy === 'PROJECT' ? { id: t.projectId, name: t.project.name } : null,
      rowClient:
        groupBy === 'CLIENT'
          ? { id: t.project.clientId, name: t.project.client.name }
          : null,
      teCount: 0,
      expCount: 0,
    }
  }

  private newGroupFromExpense(
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    t: ERow['expense'],
  ): GroupAcc {
    return {
      groupId: this.groupIdFor(groupBy, t),
      lineLabel: this.lineLabelE(groupBy, t),
      lineSub: this.lineSubE(groupBy, t),
      timeEntryIds: [],
      expenseIds: [],
      hours: 0,
      billableHours: 0,
      billableExpense: 0,
      nonBillableExpense: 0,
      isFullyLockedApproved: true,
      hasApprovableSubmitted: false,
      hasLockedApproved: false,
      rowUser:
        groupBy === 'PERSON'
          ? {
              id: t.userId,
              firstName: t.user.firstName,
              lastName: t.user.lastName,
              email: t.user.email,
            }
          : null,
      rowProject: groupBy === 'PROJECT' ? { id: t.projectId, name: t.project.name } : null,
      rowClient:
        groupBy === 'CLIENT'
          ? { id: t.project.clientId, name: t.project.client.name }
          : null,
      teCount: 0,
      expCount: 0,
    }
  }

  private lineLabel(groupBy: 'PERSON' | 'PROJECT' | 'CLIENT', t: TRow['timeEntry']) {
    if (groupBy === 'PERSON') {
      return `${t.user.firstName} ${t.user.lastName}`.trim()
    }
    if (groupBy === 'PROJECT') {
      return t.project.name
    }
    return t.project.client.name
  }

  private lineSub(
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    t: TRow['timeEntry'],
  ): string | null {
    if (groupBy === 'PROJECT') {
      return t.project.client.name
    }
    return null
  }

  private lineLabelE(
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    t: ERow['expense'],
  ) {
    if (groupBy === 'PERSON') {
      return `${t.user.firstName} ${t.user.lastName}`.trim()
    }
    if (groupBy === 'PROJECT') {
      return t.project.name
    }
    return t.project.client.name
  }

  private lineSubE(
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    t: ERow['expense'],
  ): string | null {
    if (groupBy === 'PROJECT') {
      return t.project.client.name
    }
    return null
  }

  private mergeTimeRow(g: GroupAcc, t: TRow['timeEntry']) {
    g.timeEntryIds.push(t.id)
    g.hours += Number(t.hours)
    g.billableHours += this.hoursBillable(t)
    g.teCount += 1
    this.mergeEntryFlags(g, t)
  }

  private mergeExpRow(g: GroupAcc, e: ERow['expense']) {
    g.expenseIds.push(e.id)
    const amt = Number(e.amount)
    if (e.project.isBillable) {
      g.billableExpense += amt
    } else {
      g.nonBillableExpense += amt
    }
    g.expCount += 1
    this.mergeEntryFlagsE(g, e)
  }

  private mergeEntryFlags(g: GroupAcc, t: TRow['timeEntry']) {
    if (!(t.status === 'APPROVED' && t.isLocked)) {
      g.isFullyLockedApproved = false
    }
    if (t.status === 'APPROVED' && t.isLocked) {
      g.hasLockedApproved = true
    }
    if (t.status === 'SUBMITTED' && !t.isLocked) {
      g.hasApprovableSubmitted = true
    }
  }

  private mergeEntryFlagsE(g: GroupAcc, t: ERow['expense']) {
    if (!(t.status === 'APPROVED' && t.isLocked)) {
      g.isFullyLockedApproved = false
    }
    if (t.status === 'APPROVED' && t.isLocked) {
      g.hasLockedApproved = true
    }
    if (t.status === 'SUBMITTED' && !t.isLocked) {
      g.hasApprovableSubmitted = true
    }
  }

  private aggregateGroups(
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    timeRows: TRow[],
    expenseRows: ERow[],
  ) {
    const map = new Map<string, GroupAcc>()

    for (const tr of timeRows) {
      const id = this.groupIdFor(groupBy, tr.timeEntry)
      if (!map.has(id)) {
        map.set(id, this.newGroup(groupBy, tr.timeEntry))
      }
      this.mergeTimeRow(map.get(id) as GroupAcc, tr.timeEntry)
    }
    for (const er of expenseRows) {
      const id = this.groupIdFor(groupBy, er.expense)
      if (!map.has(id)) {
        map.set(id, this.newGroupFromExpense(groupBy, er.expense))
      }
      this.mergeExpRow(map.get(id) as GroupAcc, er.expense)
    }

    return map
  }

  async getView(m: ActiveMembership, dto: ApprovalsViewQueryDto) {
    this.requireApprover(m)
    const { gte, lte } = this.parseDateRange(dto.from, dto.to)
    const entryStatus = this.pickEntryStatus(dto.entryStatus)
    const { clientIds, projectIds, roleIds, userIds } = this.parseIdLists(dto)
    const pendingViewOpts =
      entryStatus === 'SUBMITTED'
        ? {
            pendingIncludesUnsubmittedForWithdrawnSubmitters:
              await this.submitterIdsWithWithdrawnApprovalsInRange(m, gte, lte),
          }
        : undefined
    const tWhere = this.buildTimeWhere(
      m.organizationId,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
      pendingViewOpts,
    )
    const eWhere = this.buildExpenseWhere(
      m.organizationId,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
      pendingViewOpts,
    )
    const includeUser = { select: { id: true, firstName: true, lastName: true, email: true } }
    const includeProject = {
      select: {
        id: true,
        name: true,
        isBillable: true,
        clientId: true,
        client: { select: { id: true, name: true } },
      },
    }
    const [timeEntries, expenses] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: tWhere,
        include: {
          user: includeUser,
          project: includeProject,
          projectTask: { select: { isBillable: true } },
        },
      }),
      this.prisma.expense.findMany({
        where: eWhere,
        include: { user: includeUser, project: includeProject },
      }),
    ])
    const trs: TRow[] = timeEntries.map((timeEntry) => ({
      timeEntry: timeEntry as TRow['timeEntry'],
    }))
    const ers: ERow[] = expenses.map((expense) => ({
      expense: expense as ERow['expense'],
    }))
    const map = this.aggregateGroups(dto.groupBy, trs, ers)
    const rows: Array<{
      groupId: string
      lineLabel: string
      lineSub: string | null
      hours: number
      billableHours: number
      nonBillableHours: number
      billableExpense: number
      nonBillableExpense: number
      isFullyLockedApproved: boolean
      hasApprovableSubmitted: boolean
      canWithdraw: boolean
      timeEntryIds: string[]
      expenseIds: string[]
      rowUser: GroupAcc['rowUser']
      rowProject: GroupAcc['rowProject']
      rowClient: GroupAcc['rowClient']
    }> = []
    for (const g of map.values()) {
      const nonH = Math.max(0, g.hours - g.billableHours)
      const hasData = g.teCount + g.expCount > 0
      rows.push({
        groupId: g.groupId,
        lineLabel: g.lineLabel,
        lineSub: g.lineSub,
        hours: g.hours,
        billableHours: g.billableHours,
        nonBillableHours: nonH,
        billableExpense: g.billableExpense,
        nonBillableExpense: g.nonBillableExpense,
        isFullyLockedApproved: hasData && g.isFullyLockedApproved,
        hasApprovableSubmitted: g.hasApprovableSubmitted,
        canWithdraw: hasData && g.hasLockedApproved,
        timeEntryIds: g.timeEntryIds,
        expenseIds: g.expenseIds,
        rowUser: g.rowUser,
        rowProject: g.rowProject,
        rowClient: g.rowClient,
      })
    }

    rows.sort((a, b) => a.lineLabel.localeCompare(b.lineLabel))

    let totalH = 0
    let billH = 0
    let billE = 0
    let nonE = 0
    for (const tr of trs) {
      totalH += Number(tr.timeEntry.hours)
      billH += this.hoursBillable(tr.timeEntry)
    }
    for (const er of ers) {
      const a = Number(er.expense.amount)
      if (er.expense.project.isBillable) {
        billE += a
      } else {
        nonE += a
      }
    }

    return {
      from: gte.toISOString(),
      to: lte.toISOString(),
      entryStatus,
      groupBy: dto.groupBy,
      summary: {
        totalHours: totalH,
        billableHours: billH,
        nonBillableHours: Math.max(0, totalH - billH),
        totalExpense: billE + nonE,
        billableExpense: billE,
        nonBillableExpense: nonE,
      },
      rows,
    }
  }

  private timeEntryWhereForApproveSubmitter(
    m: ActiveMembership,
    gte: Date,
    lte: Date,
    clientIds: string[],
    projectIds: string[],
    roleIds: string[],
    userIds: string[],
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    groupId: string,
    submitterId: string,
  ): Prisma.TimeEntryWhereInput {
    const twg = this.timeWhereWithGroup(
      m,
      gte,
      lte,
      'SUBMITTED',
      clientIds,
      projectIds,
      roleIds,
      userIds,
      groupBy,
      groupId,
    )
    const and = [...(twg.AND as Prisma.TimeEntryWhereInput[])]
    and.push({ isLocked: false, userId: submitterId })
    return { AND: and }
  }

  private expenseWhereForApproveSubmitter(
    m: ActiveMembership,
    gte: Date,
    lte: Date,
    clientIds: string[],
    projectIds: string[],
    roleIds: string[],
    userIds: string[],
    groupBy: 'PERSON' | 'PROJECT' | 'CLIENT',
    groupId: string,
    submitterId: string,
  ): Prisma.ExpenseWhereInput {
    const twg = this.timeWhereWithGroup(
      m,
      gte,
      lte,
      'SUBMITTED',
      clientIds,
      projectIds,
      roleIds,
      userIds,
      groupBy,
      groupId,
    ) as { AND: Prisma.ExpenseWhereInput[] }
    const and = [...(twg.AND as Prisma.ExpenseWhereInput[])]
    and.push({ isLocked: false, userId: submitterId })
    return { AND: and }
  }

  /**
   * Load entries in the same filter and group for approve/withdraw.
   * Mutations use `entryStatus=ALL` on the time/expense filter so approved rows are included.
   */
  private async loadGroupEntriesForMutate(
    m: ActiveMembership,
    q: ApprovalsViewQueryDto,
    groupId: string,
  ) {
    const { gte, lte } = this.parseDateRange(q.from, q.to)
    const entryStatus = 'ALL' as const
    const { clientIds, projectIds, roleIds, userIds } = this.parseIdLists(q)
    const tWhere = this.timeWhereWithGroup(
      m,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
      q.groupBy,
      groupId,
    )
    const eWhere = this.expenseWhereWithGroup(
      m,
      gte,
      lte,
      entryStatus,
      clientIds,
      projectIds,
      roleIds,
      userIds,
      q.groupBy,
      groupId,
    )
    return Promise.all([
      this.prisma.timeEntry.findMany({
        where: tWhere,
        select: { id: true, userId: true, status: true, isLocked: true, approvalId: true },
      }),
      this.prisma.expense.findMany({
        where: eWhere,
        select: { id: true, userId: true, status: true, isLocked: true, approvalId: true },
      }),
    ])
  }

  async approveGroup(
    m: ActiveMembership,
    approverUserId: string,
    body: ApprovalsViewQueryDto & { groupId: string },
  ) {
    this.requireApprover(m)
    const { gte, lte } = this.parseDateRange(body.from, body.to)
    const { groupId, groupBy } = body
    const { clientIds, projectIds, roleIds, userIds } = this.parseIdLists(body)
    const [timeRows, expenseRows] = await this.loadGroupEntriesForMutate(m, body, groupId)
    const toApproveT = timeRows.filter((x) => x.status === 'SUBMITTED' && !x.isLocked)
    const toApproveE = expenseRows.filter((x) => x.status === 'SUBMITTED' && !x.isLocked)
    if (toApproveT.length === 0 && toApproveE.length === 0) {
      throw new BadRequestException('No submitted items are available to approve')
    }

    const byUser = new Map<string, { hasTime: boolean; hasExpense: boolean }>()
    for (const t of toApproveT) {
      if (!byUser.has(t.userId)) {
        byUser.set(t.userId, { hasTime: false, hasExpense: false })
      }
      byUser.get(t.userId)!.hasTime = true
    }
    for (const e of toApproveE) {
      if (!byUser.has(e.userId)) {
        byUser.set(e.userId, { hasTime: false, hasExpense: false })
      }
      byUser.get(e.userId)!.hasExpense = true
    }

    const inApprovalWindow = (p: { periodStart: Date; periodEnd: Date }, d: Date) => {
      const t0 = d.getTime()
      return p.periodStart.getTime() <= t0 && t0 <= p.periodEnd.getTime()
    }

    const created = await this.prisma.$transaction(async (tx) => {
      let n = 0
      for (const [submitterId, flags] of byUser) {
        if (!flags.hasTime && !flags.hasExpense) {
          continue
        }
        const tBase = this.timeEntryWhereForApproveSubmitter(
          m,
          gte,
          lte,
          clientIds,
          projectIds,
          roleIds,
          userIds,
          groupBy,
          groupId,
          submitterId,
        )
        const eBase = this.expenseWhereForApproveSubmitter(
          m,
          gte,
          lte,
          clientIds,
          projectIds,
          roleIds,
          userIds,
          groupBy,
          groupId,
          submitterId,
        )
        const pendingInRange = await tx.approval.findMany({
          where: {
            submitterId,
            status: 'PENDING',
            periodStart: { lte: lte },
            periodEnd: { gte: gte },
          },
          orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
          select: { id: true, periodStart: true, periodEnd: true },
        })
        const periodById = new Map(
          pendingInRange.map(
            (p) => [p.id, p] as [string, { id: string; periodStart: Date; periodEnd: Date }],
          ),
        )
        const allApprovalIds = new Set<string>()

        if (flags.hasTime) {
          const tIn = await tx.timeEntry.findMany({
            where: tBase,
            select: { spentDate: true, approvalId: true },
          })
          for (const row of tIn) {
            if (row.approvalId) {
              allApprovalIds.add(row.approvalId)
            } else {
              const p0 = pendingInRange.find((p) => inApprovalWindow(p, row.spentDate))
              if (!p0) {
                throw new BadRequestException(
                  'A time entry in this view is not covered by a pending approval; complete submit first',
                )
              }
              allApprovalIds.add(p0.id)
            }
          }
        }
        if (flags.hasExpense) {
          const eIn = await tx.expense.findMany({
            where: eBase,
            select: { spentDate: true, approvalId: true },
          })
          for (const row of eIn) {
            if (row.approvalId) {
              allApprovalIds.add(row.approvalId)
            } else {
              const p0 = pendingInRange.find((p) => inApprovalWindow(p, row.spentDate))
              if (!p0) {
                throw new BadRequestException(
                  'An expense in this view is not covered by a pending approval; complete submit first',
                )
              }
              allApprovalIds.add(p0.id)
            }
          }
        }
        for (const id of allApprovalIds) {
          if (periodById.has(id)) {
            continue
          }
          const a = await tx.approval.findFirst({
            where: { id, submitterId, status: 'PENDING' },
            select: { id: true, periodStart: true, periodEnd: true },
          })
          if (!a) {
            throw new BadRequestException('Unable to resolve a pending approval for linked entries')
          }
          periodById.set(a.id, a)
        }
        for (const aid of allApprovalIds) {
          const u = await tx.approval.updateMany({
            where: { id: aid, submitterId, status: 'PENDING' },
            data: { status: 'APPROVED', approverId: approverUserId },
          })
          if (u.count === 0) {
            const still = await tx.approval.findFirst({ where: { id: aid, submitterId } })
            if (!still || still.status !== 'APPROVED') {
              throw new BadRequestException('Unable to update approval; submitter mismatch or missing')
            }
          }
        }
        for (const aid of allApprovalIds) {
          const p = periodById.get(aid)
          if (!p) {
            throw new BadRequestException('Internal error: missing approval period bounds')
          }
          const { count: tc } = await tx.timeEntry.updateMany({
            where: {
              AND: [
                ...(tBase.AND as Prisma.TimeEntryWhereInput[]),
                { spentDate: { gte: p.periodStart, lte: p.periodEnd } },
              ],
            },
            data: { status: 'APPROVED', isLocked: true, approvalId: aid },
          })
          n += tc
          const { count: ec } = await tx.expense.updateMany({
            where: {
              AND: [
                ...(eBase.AND as Prisma.ExpenseWhereInput[]),
                { spentDate: { gte: p.periodStart, lte: p.periodEnd } },
              ],
            },
            data: { status: 'APPROVED', isLocked: true, approvalId: aid },
          })
          n += ec
        }
      }
      return n
    })
    return { ok: true as const, updated: created }
  }

  async approveAllVisible(
    m: ActiveMembership,
    approverUserId: string,
    q: ApprovalsViewQueryDto,
  ) {
    this.requireApprover(m)
    const view = await this.getView(m, q)
    const groupIds = view.rows
      .filter((r) => r.hasApprovableSubmitted)
      .map((r) => r.groupId)
    if (groupIds.length === 0) {
      throw new BadRequestException('No groups have items pending approval')
    }
    let total = 0
    for (const groupId of groupIds) {
      const res = await this.approveGroup(m, approverUserId, { ...q, groupId })
      total += res.updated
    }
    return { ok: true as const, groups: groupIds.length, updated: total }
  }

  async withdrawGroup(
    m: ActiveMembership,
    body: ApprovalsViewQueryDto & { groupId: string },
  ) {
    this.requireApprover(m)
    const [timeRows, expenseRows] = await this.loadGroupEntriesForMutate(m, body, body.groupId)
    const tIds = timeRows.filter((x) => x.status === 'APPROVED' && x.isLocked).map((x) => x.id)
    const eIds = expenseRows.filter((x) => x.status === 'APPROVED' && x.isLocked).map((x) => x.id)
    if (tIds.length === 0 && eIds.length === 0) {
      throw new BadRequestException('No approved items are available to withdraw')
    }
    const approvalIdSet = new Set<string | null>()

    await this.prisma.$transaction(async (tx) => {
      if (tIds.length) {
        const rows = await tx.timeEntry.findMany({
          where: { id: { in: tIds }, project: { organizationId: m.organizationId } },
          select: { id: true, approvalId: true },
        })
        for (const r of rows) {
          approvalIdSet.add(r.approvalId)
        }
        await tx.timeEntry.updateMany({
          where: { id: { in: tIds } },
          data: { status: 'SUBMITTED' as const, isLocked: false, approvalId: null },
        })
      }
      if (eIds.length) {
        const erows = await tx.expense.findMany({
          where: { id: { in: eIds }, project: { organizationId: m.organizationId } },
          select: { id: true, approvalId: true },
        })
        for (const r of erows) {
          approvalIdSet.add(r.approvalId)
        }
        await tx.expense.updateMany({
          where: { id: { in: eIds } },
          data: { status: 'SUBMITTED' as const, isLocked: false, approvalId: null },
        })
      }
      for (const aid of approvalIdSet) {
        if (aid) {
          await tx.approval
            .update({ where: { id: aid }, data: { status: 'WITHDRAWN' } })
            .catch(() => undefined)
        }
      }
    })
    return { ok: true as const, timeEntries: tIds.length, expenses: eIds.length }
  }

  notifyGroupStub(_m: ActiveMembership, _body: ApprovalsViewQueryDto & { groupId: string }) {
    this.requireApprover(_m)
    return {
      ok: true as const,
      sent: false,
      message: 'Email delivery is not configured yet',
    }
  }
}

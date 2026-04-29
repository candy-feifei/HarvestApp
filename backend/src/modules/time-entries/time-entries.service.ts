import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import type { ActiveMembership } from '../organization/organization-context.service'
import { CreateTimeEntryDto } from './dto/create-time-entry.dto'
import { ListTimeEntriesQueryDto } from './dto/list-time-entries.query.dto'
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto'
import { CopyFromRecentDayDto } from './dto/copy-from-recent-day.dto'
import { SubmitWeekDto } from './dto/submit-week.dto'
import { StartTimeEntryTimerDto } from './dto/start-time-entry-timer.dto'

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n)
}

function decToNumber(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0
  return Number(d)
}

/** YYYY-MM-DD -> UTC 当天 0:00 */
function utcDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((p) => parseInt(p, 10))
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

function startOfIsoWeekFromUtcDate(ref: Date): Date {
  const w = ref.getUTCDay()
  const add = w === 0 ? -6 : 1 - w
  return new Date(
    Date.UTC(
      ref.getUTCFullYear(),
      ref.getUTCMonth(),
      ref.getUTCDate() + add,
      0,
      0,
      0,
      0,
    ),
  )
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + n,
      0,
      0,
      0,
      0,
    ),
  )
}

/**
 * ISO 周右边界（不含）：次周周一 00:00:00.000Z，与 list 的 toExclusive 一致。
 * 存库用此值作为 periodEnd，避免与「周日 0:00」混成「周起点」；亦等价于「周日下午 23:59:59.999」的下一秒。
 */
function isoWeekExclusiveEndUtc(weekMonday: Date): Date {
  return addUtcDays(weekMonday, 7)
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 与某「日历月」有交集的 ISO 周（以周一为起点），按时间升序。
 * `anchorInMonth` 取目标周一即所在月的周序对应关系（与表头周一致）。
 */
function isoWeekMondaysOverlappingCalendarMonthUtc(anchorInMonth: Date): Date[] {
  const y = anchorInMonth.getUTCFullYear()
  const m = anchorInMonth.getUTCMonth()
  const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  const monthEndEx = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0))
  let w = startOfIsoWeekFromUtcDate(monthStart)
  const out: Date[] = []
  while (w.getTime() < monthEndEx.getTime()) {
    const wEnd = addUtcDays(w, 7)
    if (wEnd.getTime() > monthStart.getTime() && w.getTime() < monthEndEx.getTime()) {
      out.push(new Date(w.getTime()))
    }
    w = addUtcDays(w, 7)
  }
  return out
}

type TimeEntrySerializeInput = Prisma.TimeEntryGetPayload<{
  include: {
    project: { select: { name: true, client: { select: { id: true, name: true } } } }
    projectTask: { include: { task: { select: { name: true } } } }
  }
}>

function monthRangeUtc(ym: string): { from: Date; toExclusive: Date } {
  const [y, m] = ym.split('-').map((p) => parseInt(p, 10))
  if (Number.isNaN(y) || m < 1 || m > 12) {
    throw new BadRequestException('Month must be in YYYY-MM format.')
  }
  const monthIndex = m - 1
  return {
    from: new Date(Date.UTC(y, monthIndex, 1, 0, 0, 0, 0)),
    toExclusive: new Date(Date.UTC(y, monthIndex + 1, 1, 0, 0, 0, 0)),
  }
}

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 某用户在某组织、某自然日已填报工时合计（可排除一条，用于更新前校验） */
  private async sumHoursForUserOrgDay(
    db: Pick<PrismaClient, 'timeEntry'>,
    userId: string,
    orgId: string,
    spentDate: Date,
    excludeEntryId?: string,
  ): Promise<number> {
    const agg = await db.timeEntry.aggregate({
      where: {
        userId,
        spentDate,
        project: { organizationId: orgId },
        ...(excludeEntryId ? { NOT: { id: excludeEntryId } } : {}),
      },
      _sum: { hours: true },
    })
    return decToNumber(agg._sum.hours)
  }

  private isElevatedRole(role: string): boolean {
    return role === 'ADMINISTRATOR' || role === 'MANAGER'
  }

  /**
   * 仅按 `approvals` 表、日期段筛选：与 ISO 周 spentDate 区间 [周一 0:00, 次周一 0:00) 重叠的「填报窗口」
   * periodStart <= 该周周一，且 periodEnd 不早于该周周日 0:00（与 toExclusive/次周一 0:00 的两种存法兼容，见历史迁移）
   * orderBy: 最「紧」的 periodStart 优先
   */
  private findAnyApprovalWindowCoveringIsoWeek(userId: string, from: Date, weekLastDayStart: Date) {
    return this.prisma.approval.findFirst({
      where: {
        submitterId: userId,
        periodStart: { lte: from },
        periodEnd: { gte: weekLastDayStart },
      },
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
    })
  }

  /**
   * Timesheet 列表/撤回/计时器：以 approvals 为准。
   * 若**存在**覆盖本 ISO 周且 status=APPROVED 的行 → 只读/Withdraw；否则再取 PENDING/其它（用于 Resubmit/展示周期）。
   */
  private async findWeekApprovalForTimesheetUi(
    userId: string,
    from: Date,
    weekLastDayStart: Date,
  ) {
    const approved = await this.prisma.approval.findFirst({
      where: {
        submitterId: userId,
        status: 'APPROVED',
        periodStart: { lte: from },
        periodEnd: { gte: weekLastDayStart },
      },
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
    })
    if (approved) {
      return approved
    }
    return this.findAnyApprovalWindowCoveringIsoWeek(userId, from, weekLastDayStart)
  }

  private resolveTargetUserId(
    m: ActiveMembership,
    forUser: string | undefined,
    selfId: string,
  ): string {
    if (forUser && forUser !== selfId) {
      if (!this.isElevatedRole(m.systemRole)) {
        throw new ForbiddenException('Only administrators or managers can view other users’ time entries.')
      }
      return forUser
    }
    return selfId
  }

  private async canLogTimeOnProject(
    userId: string,
    projectId: string,
    isElevated: boolean,
  ): Promise<boolean> {
    if (isElevated) return true
    const a = await this.prisma.projectAssignment.findFirst({
      where: { userId, projectId },
    })
    return Boolean(a)
  }

  async listAssignableRows(membership: ActiveMembership, user: CurrentUserPayload) {
    const orgId = membership.organizationId
    const elevated = this.isElevatedRole(membership.systemRole)

    const whereTasks: Prisma.ProjectTaskWhereInput = {
      project: {
        isArchived: false,
        organizationId: orgId,
        ...(elevated
          ? {}
          : { assignments: { some: { userId: user.userId } } }),
      },
    }

    const rows = await this.prisma.projectTask.findMany({
      where: whereTasks,
      orderBy: [
        { project: { client: { name: 'asc' } } },
        { project: { name: 'asc' } },
        { task: { name: 'asc' } },
      ],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        task: { select: { id: true, name: true } },
      },
    })
    return {
      rows: rows.map((r) => ({
        projectTaskId: r.id,
        projectId: r.projectId,
        taskId: r.taskId,
        clientId: r.project.client.id,
        clientName: r.project.client.name,
        projectName: r.project.name,
        taskName: r.task.name,
      })),
    }
  }

  /**
   * Track time 弹窗：从 `projects` 表查询（经 clientId 关联 client），
   * 并包含各项目下未归档的 project_tasks → task。权限与 assignable-rows 一致。
   */
  async listTrackTimeOptions(membership: ActiveMembership, user: CurrentUserPayload) {
    const orgId = membership.organizationId
    const elevated = this.isElevatedRole(membership.systemRole)

    const where: Prisma.ProjectWhereInput = {
      isArchived: false,
      organizationId: orgId,
      projectTasks: {
        some: {
          task: { isArchived: false },
        },
      },
      ...(elevated
        ? {}
        : { assignments: { some: { userId: user.userId } } }),
    }

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: [{ client: { name: 'asc' } }, { name: 'asc' }],
      include: {
        client: { select: { id: true, name: true } },
        projectTasks: {
          where: { task: { isArchived: false } },
          orderBy: { task: { name: 'asc' } },
          include: {
            task: { select: { id: true, name: true } },
          },
        },
      },
    })

    return {
      projects: projects
        .filter((p) => p.projectTasks.length > 0)
        .map((p) => ({
          projectId: p.id,
          name: p.name,
          clientId: p.clientId,
          clientName: p.client.name,
          tasks: p.projectTasks.map((pt) => ({
            projectTaskId: pt.id,
            taskId: pt.taskId,
            taskName: pt.task.name,
          })),
        })),
    }
  }

  private parseRange(
    q: ListTimeEntriesQueryDto,
  ): { from: Date; toExclusive: Date; mode: 'week' | 'month' } {
    if (q.week && q.month) {
      throw new BadRequestException('Please specify only one of: week or month.')
    }
    if (q.week) {
      const ref = utcDayStart(q.week)
      const mon = startOfIsoWeekFromUtcDate(ref)
      return {
        from: mon,
        toExclusive: addUtcDays(mon, 7),
        mode: 'week',
      }
    }
    if (q.month) {
      const { from, toExclusive } = monthRangeUtc(q.month)
      return { from, toExclusive, mode: 'month' }
    }
    const now = new Date()
    const todayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    )
    const mon = startOfIsoWeekFromUtcDate(todayUtc)
    return { from: mon, toExclusive: addUtcDays(mon, 7), mode: 'week' }
  }

  private async getProjectTaskInOrg(
    orgId: string,
    projectTaskId: string,
  ): Promise<{
    id: string
    projectId: string
    project: { name: string; isArchived: boolean; organizationId: string }
    task: { name: string }
  }> {
    const row = await this.prisma.projectTask.findFirst({
      where: { id: projectTaskId, project: { organizationId: orgId } },
      include: { project: true, task: true },
    })
    if (!row || row.project.isArchived) {
      throw new NotFoundException('Project task not found or archived.')
    }
    return row
  }

  private serializeEntry(e: TimeEntrySerializeInput) {
    return {
      id: e.id,
      userId: e.userId,
      projectId: e.projectId,
      projectTaskId: e.projectTaskId,
      clientId: e.project.client.id,
      clientName: e.project.client.name,
      projectName: e.project.name,
      taskName: e.projectTask.task.name,
      date: toYmd(e.spentDate),
      spentDate: e.spentDate.toISOString(),
      hours: decToNumber(e.hours),
      notes: e.notes ?? null,
      status: e.status,
      // 仅「已批准」锁定；已提交待审批 (SUBMITTED) 可继续增改，前端依此置灰/解锁。
      isLocked: e.status === 'APPROVED',
      // DB 已移除 time_entries.createdAt/updatedAt，用 spentDate 占位供前端结构兼容
      createdAt: e.spentDate.toISOString(),
      updatedAt: e.spentDate.toISOString(),
    }
  }

  async list(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    q: ListTimeEntriesQueryDto,
  ) {
    const targetUserId = this.resolveTargetUserId(membership, q.forUser, user.userId)
    const { from, toExclusive, mode } = this.parseRange(q)
    const orgId = membership.organizationId

    if (q.forUser && this.isElevatedRole(membership.systemRole)) {
      const member = await this.prisma.userOrganization.findFirst({
        where: { userId: targetUserId, organizationId: orgId, status: 'ACTIVE' },
      })
      if (!member) {
        throw new BadRequestException('The specified user is not an active member of this organization.')
      }
    }

    const weekLastDayStart = addUtcDays(from, 6)
    const weekWindow =
      mode === 'week' ? await this.findWeekApprovalForTimesheetUi(targetUserId, from, weekLastDayStart) : null

    const items = await this.prisma.timeEntry.findMany({
      where: {
        userId: targetUserId,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
      },
      orderBy: [{ spentDate: 'asc' }, { projectId: 'asc' }, { id: 'asc' }],
      include: {
        project: {
          select: {
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        projectTask: { include: { task: { select: { name: true } } } },
      },
    })
    return {
      mode,
      range: {
        from: from.toISOString(),
        toExclusive: toExclusive.toISOString(),
      },
      forUser: targetUserId,
      weekApproval: weekWindow
        ? {
            id: weekWindow.id,
            status: weekWindow.status,
            periodStart: weekWindow.periodStart.toISOString(),
            periodEnd: weekWindow.periodEnd.toISOString(),
          }
        : null,
      items: items.map((e) => this.serializeEntry(e)),
    }
  }

  /**
   * 在目标自然日 `date`（UTC 日界）**之前**、**最近一次有工时的那一整天**，复制到 `date` 当天（新建行）。
   * 例：今天周三，在周一填过工时时，将「离周三最近、且已有记录的那一天」（通常周一）的条目复制到本周三。
   */
  async copyFromMostRecentDay(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    body: CopyFromRecentDayDto,
  ) {
    const orgId = membership.organizationId
    const elevated = this.isElevatedRole(membership.systemRole)
    const targetFrom = utcDayStart(body.date)
    const mon = startOfIsoWeekFromUtcDate(targetFrom)
    const weekLastDayStart = addUtcDays(mon, 6)

    const wk = await this.findWeekApprovalForTimesheetUi(
      user.userId,
      mon,
      weekLastDayStart,
    )
    if (wk?.status === 'APPROVED') {
      throw new BadRequestException('This week is approved and cannot be modified or copied into.')
    }

    const maxRow = await this.prisma.timeEntry.aggregate({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { lt: targetFrom },
      },
      _max: { spentDate: true },
    })
    if (!maxRow._max.spentDate) {
      return {
        copied: 0,
        skipped: 0,
        sourceDate: null as string | null,
        targetDate: targetFrom.toISOString(),
        message: 'No earlier day with time entries was found to copy from.',
      }
    }

    const src = maxRow._max.spentDate
    const sourceFrom = new Date(
      Date.UTC(
        src.getUTCFullYear(),
        src.getUTCMonth(),
        src.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    )
    if (sourceFrom.getTime() >= targetFrom.getTime()) {
      return {
        copied: 0,
        skipped: 0,
        sourceDate: null,
        targetDate: targetFrom.toISOString(),
        message: 'No earlier day with time entries was found to copy from.',
      }
    }

    const sourceToEx = addUtcDays(sourceFrom, 1)
    const sourceEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: sourceFrom, lt: sourceToEx },
      },
      orderBy: [{ spentDate: 'asc' }, { id: 'asc' }],
    })
    if (sourceEntries.length === 0) {
      return {
        copied: 0,
        skipped: 0,
        sourceDate: sourceFrom.toISOString(),
        targetDate: targetFrom.toISOString(),
        message: 'No valid entries were found on the source day.',
      }
    }

    let copied = 0
    let skipped = 0

    await this.prisma.$transaction(async (tx) => {
      for (const se of sourceEntries) {
        const h = decToNumber(se.hours)
        if (h <= 0) {
          skipped += 1
          continue
        }

        let pt
        try {
          pt = await this.getProjectTaskInOrg(orgId, se.projectTaskId)
        } catch {
          skipped += 1
          continue
        }
        if (!(await this.canLogTimeOnProject(user.userId, pt.projectId, elevated))) {
          skipped += 1
          continue
        }

        const daySum = await this.sumHoursForUserOrgDay(
          tx,
          user.userId,
          orgId,
          targetFrom,
        )
        if (daySum + h > 24) {
          skipped += 1
          continue
        }

        await tx.timeEntry.create({
          data: {
            userId: user.userId,
            projectId: pt.projectId,
            projectTaskId: se.projectTaskId,
            spentDate: targetFrom,
            hours: se.hours,
            notes: se.notes,
          },
        })
        copied += 1
      }
    })

    return {
      copied,
      skipped,
      sourceDate: sourceFrom.toISOString(),
      targetDate: targetFrom.toISOString(),
    }
  }

  /**
   * 以目标周 `weekOf` 所在**自然月**内 ISO 周序为基准：将「本月中上一周」整周条目按星期对齐复制到目标周（新建行）。
   * 若目标已是该月内第一周，则来源为上一自然 ISO 周（周一起算）。
   * 与 copy-from-recent-day 区分：本接口按整周、且来源由月内周序决定。
   */
  async copyFromPreviousWeekInMonth(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    body: SubmitWeekDto,
  ) {
    const orgId = membership.organizationId
    const elevated = this.isElevatedRole(membership.systemRole)
    const dayOf = utcDayStart(body.weekOf)
    const targetFrom = startOfIsoWeekFromUtcDate(dayOf)
    const weekLastDayStart = addUtcDays(targetFrom, 6)

    const wk = await this.findWeekApprovalForTimesheetUi(
      user.userId,
      targetFrom,
      weekLastDayStart,
    )
    if (wk?.status === 'APPROVED') {
      throw new BadRequestException('This week is approved and cannot be modified or copied into.')
    }

    const mondays = isoWeekMondaysOverlappingCalendarMonthUtc(targetFrom)
    const tYmd = toYmd(targetFrom)
    const idx = mondays.findIndex((d) => toYmd(d) === tYmd)
    const sourceFrom =
      idx > 0
        ? new Date(mondays[idx - 1]!.getTime())
        : addUtcDays(targetFrom, -7)
    const sourceToEx = addUtcDays(sourceFrom, 7)

    const sourceEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: sourceFrom, lt: sourceToEx },
      },
      orderBy: [{ spentDate: 'asc' }, { id: 'asc' }],
    })

    const hasPositive = sourceEntries.some((e) => decToNumber(e.hours) > 0)
    if (!hasPositive) {
      return {
        copied: 0,
        skipped: 0,
        sourceWeekFrom: sourceFrom.toISOString(),
        targetWeekFrom: targetFrom.toISOString(),
        message: 'No time entries were found in the source week to copy.',
      }
    }

    const targetToEx = addUtcDays(targetFrom, 7)
    const msPerDay = 24 * 60 * 60 * 1000

    let copied = 0
    let skipped = 0

    await this.prisma.$transaction(async (tx) => {
      for (const se of sourceEntries) {
        const h = decToNumber(se.hours)
        if (h <= 0) {
          skipped += 1
          continue
        }
        if (se.spentDate < sourceFrom || se.spentDate >= sourceToEx) {
          skipped += 1
          continue
        }
        const offsetDays = Math.round((se.spentDate.getTime() - sourceFrom.getTime()) / msPerDay)
        if (offsetDays < 0 || offsetDays > 6) {
          skipped += 1
          continue
        }
        const newSpent = addUtcDays(targetFrom, offsetDays)
        if (newSpent.getTime() < targetFrom.getTime() || newSpent.getTime() >= targetToEx.getTime()) {
          skipped += 1
          continue
        }

        let pt
        try {
          pt = await this.getProjectTaskInOrg(orgId, se.projectTaskId)
        } catch {
          skipped += 1
          continue
        }
        if (!(await this.canLogTimeOnProject(user.userId, pt.projectId, elevated))) {
          skipped += 1
          continue
        }

        const daySum = await this.sumHoursForUserOrgDay(tx, user.userId, orgId, newSpent)
        if (daySum + h > 24) {
          skipped += 1
          continue
        }

        await tx.timeEntry.create({
          data: {
            userId: user.userId,
            projectId: pt.projectId,
            projectTaskId: se.projectTaskId,
            spentDate: newSpent,
            hours: se.hours,
            notes: se.notes,
          },
        })
        copied += 1
      }
    })

    return {
      copied,
      skipped,
      sourceWeekFrom: sourceFrom.toISOString(),
      targetWeekFrom: targetFrom.toISOString(),
    }
  }

  async create(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    body: CreateTimeEntryDto,
  ) {
    const orgId = membership.organizationId
    const elevated = this.isElevatedRole(membership.systemRole)
    const dayStart = utcDayStart(body.date)
    const pt = await this.getProjectTaskInOrg(orgId, body.projectTaskId)
    if (!(await this.canLogTimeOnProject(user.userId, pt.projectId, elevated))) {
      throw new ForbiddenException('You are not assigned to this project.')
    }

    if (body.hours <= 0) {
      throw new BadRequestException('Hours must be greater than 0.')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const daySum = await this.sumHoursForUserOrgDay(
        tx,
        user.userId,
        orgId,
        dayStart,
      )
      if (daySum + body.hours > 24) {
        throw new BadRequestException('Total hours for a single day must not exceed 24.')
      }
      return tx.timeEntry.create({
        data: {
          userId: user.userId,
          projectId: pt.projectId,
          projectTaskId: body.projectTaskId,
          spentDate: dayStart,
          hours: toDecimal(body.hours),
          notes: body.notes ?? null,
        },
        include: {
          project: {
            select: {
              name: true,
              client: { select: { id: true, name: true } },
            },
          },
          projectTask: { include: { task: { select: { name: true } } } },
        },
      })
    })
    return { action: 'saved' as const, item: this.serializeEntry(result as TimeEntrySerializeInput) }
  }

  async update(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    id: string,
    body: UpdateTimeEntryDto,
  ) {
    if (body.hours === undefined && body.notes === undefined) {
      throw new BadRequestException('No fields provided to update.')
    }
    const orgId = membership.organizationId
    const row = await this.prisma.timeEntry.findFirst({
      where: { id, userId: user.userId, project: { organizationId: orgId } },
      include: {
        project: {
          select: {
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        projectTask: { include: { task: { select: { name: true } } } },
      },
    })
    if (!row) {
      throw new NotFoundException('Time entry not found.')
    }
    if (row.status === 'APPROVED') {
      throw new ConflictException('This entry is approved and cannot be edited.')
    }
    if (body.hours !== undefined && body.hours === 0) {
      await this.prisma.timeEntry.delete({ where: { id } })
      return { action: 'deleted' as const, id }
    }
    if (body.hours !== undefined) {
      const others = await this.sumHoursForUserOrgDay(
        this.prisma,
        row.userId,
        orgId,
        row.spentDate,
        id,
      )
      if (others + body.hours > 24) {
        throw new BadRequestException('Total hours for a single day must not exceed 24.')
      }
    }
    const u = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(body.hours !== undefined ? { hours: toDecimal(body.hours) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: {
        project: {
          select: {
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        projectTask: { include: { task: { select: { name: true } } } },
      },
    })
    return { action: 'saved' as const, item: this.serializeEntry(u) }
  }

  async remove(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    id: string,
  ) {
    const orgId = membership.organizationId
    const row = await this.prisma.timeEntry.findFirst({
      where: { id, userId: user.userId, project: { organizationId: orgId } },
    })
    if (!row) {
      throw new NotFoundException('Time entry not found.')
    }
    if (row.status === 'APPROVED') {
      throw new ConflictException('This entry is approved and cannot be deleted.')
    }
    await this.prisma.timeEntry.delete({ where: { id } })
  }

  async submitWeek(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    body: SubmitWeekDto,
  ) {
    const dayStart = utcDayStart(body.weekOf)
    const from = startOfIsoWeekFromUtcDate(dayStart)
    const toExclusive = addUtcDays(from, 7)
    const weekLastDayStart = addUtcDays(from, 6)
    const orgId = membership.organizationId

    let window = await this.findAnyApprovalWindowCoveringIsoWeek(user.userId, from, weekLastDayStart)
    if (!window) {
      window = await this.prisma.approval.create({
        data: {
          submitterId: user.userId,
          status: 'PENDING',
          periodStart: from,
          periodEnd: isoWeekExclusiveEndUtc(from),
        },
      })
    } else if (window.status === 'WITHDRAWN' || window.status === 'REJECTED') {
      const periodEnd = isoWeekExclusiveEndUtc(from)
      await this.prisma.approval.update({
        where: { id: window.id },
        data: { status: 'PENDING', periodEnd },
      })
      window = { ...window, status: 'PENDING', periodEnd }
    }
    if (window.status === 'APPROVED') {
      throw new BadRequestException(
        'This approval period is already approved; this week cannot be submitted again.',
      )
    }

    const outOfWindow = await this.prisma.timeEntry.findFirst({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
        OR: [{ spentDate: { lt: window.periodStart } }, { spentDate: { gt: window.periodEnd } }],
      },
      select: { id: true },
    })
    if (outOfWindow) {
      throw new BadRequestException(
        'Some time entries in this week fall outside the current approval period (periodStart–periodEnd). Please adjust dates and try again.',
      )
    }

    const r = await this.prisma.timeEntry.updateMany({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
        status: { not: 'APPROVED' },
      },
      data: {
        status: 'SUBMITTED',
        isLocked: false,
        approvalId: window.id,
      },
    })
    return { lockedCount: r.count, weekFrom: from.toISOString(), toExclusive: toExclusive.toISOString() }
  }

  /**
   * 撤回本 ISO 周内的提交/批准：解锁并恢复为可编辑（UNSUBMITTED）。
   * 仅管理员/经理可执行（避免普通成员随意撤销流程）。
   */
  async withdrawWeek(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    body: SubmitWeekDto,
  ) {
    if (!this.isElevatedRole(membership.systemRole)) {
      throw new ForbiddenException('Only administrators or managers can withdraw a submitted/approved week.')
    }
    const dayStart = utcDayStart(body.weekOf)
    const from = startOfIsoWeekFromUtcDate(dayStart)
    const toExclusive = addUtcDays(from, 7)
    const weekLastDayStart = addUtcDays(from, 6)
    const orgId = membership.organizationId
    const r = await this.prisma.timeEntry.updateMany({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      data: {
        isLocked: false,
        status: 'UNSUBMITTED',
        approvalId: null,
      },
    })
    const win = await this.findWeekApprovalForTimesheetUi(user.userId, from, weekLastDayStart)
    if (win) {
      await this.prisma.approval.update({
        where: { id: win.id },
        data: { status: 'WITHDRAWN' },
      })
    }
    return { unlockedCount: r.count, weekFrom: from.toISOString(), toExclusive: toExclusive.toISOString() }
  }

  async getActiveTimer(_membership: ActiveMembership, _user: CurrentUserPayload) {
    return { timer: null }
  }

  async startTimer(
    _membership: ActiveMembership,
    _user: CurrentUserPayload,
    _body: StartTimeEntryTimerDto,
  ) {
    throw new ServiceUnavailableException(
      '服务器端计时器表已随迁移移除，请使用手动填写工时；接口保留仅为兼容前端。',
    )
  }

  async stopTimer(
    _membership: ActiveMembership,
    _user: CurrentUserPayload,
    _timerId: string,
  ) {
    throw new ServiceUnavailableException(
      '服务器端计时器表已随迁移移除，请使用手动填写工时；接口保留仅为兼容前端。',
    )
  }

  async approve(
    membership: ActiveMembership,
    id: string,
  ) {
    if (!this.isElevatedRole(membership.systemRole)) {
      throw new ForbiddenException('Only administrators or managers can approve time entries.')
    }
    const orgId = membership.organizationId
    const row = await this.prisma.timeEntry.findFirst({
      where: { id, project: { organizationId: orgId } },
      include: {
        project: {
          select: {
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        projectTask: { include: { task: { select: { name: true } } } },
      },
    })
    if (!row) {
      throw new NotFoundException('Time entry not found.')
    }
    if (row.status === 'APPROVED') {
      return { item: this.serializeEntry(row) }
    }
    if (row.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted time entries can be approved.')
    }
    const u = await this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'APPROVED', isLocked: true },
      include: {
        project: {
          select: {
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        projectTask: { include: { task: { select: { name: true } } } },
      },
    })
    if (u.approvalId) {
      await this.prisma.approval.update({
        where: { id: u.approvalId },
        data: { status: 'APPROVED' },
      })
    }
    return { item: this.serializeEntry(u) }
  }
}

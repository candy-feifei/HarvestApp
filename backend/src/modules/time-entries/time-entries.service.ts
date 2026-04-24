import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import type { ActiveMembership } from '../organization/organization-context.service'
import { CreateTimeEntryDto } from './dto/create-time-entry.dto'
import { ListTimeEntriesQueryDto } from './dto/list-time-entries.query.dto'
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto'
import { SubmitWeekDto } from './dto/submit-week.dto'

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

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthRangeUtc(ym: string): { from: Date; toExclusive: Date } {
  const [y, m] = ym.split('-').map((p) => parseInt(p, 10))
  if (Number.isNaN(y) || m < 1 || m > 12) {
    throw new BadRequestException('月份格式应为 YYYY-MM 且月有效')
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

  private isElevatedRole(role: string): boolean {
    return role === 'ADMINISTRATOR' || role === 'MANAGER'
  }

  private resolveTargetUserId(
    m: ActiveMembership,
    forUser: string | undefined,
    selfId: string,
  ): string {
    if (forUser && forUser !== selfId) {
      if (!this.isElevatedRole(m.systemRole)) {
        throw new ForbiddenException('仅管理员或经理可查看他人工时')
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

  private parseRange(
    q: ListTimeEntriesQueryDto,
  ): { from: Date; toExclusive: Date; mode: 'week' | 'month' } {
    if (q.week && q.month) {
      throw new BadRequestException('请只指定 week 或 month 之一')
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
      throw new NotFoundException('未找到项目任务或已归档')
    }
    return row
  }

  private serializeEntry(
    e: {
      id: string
      userId: string
      projectId: string
      projectTaskId: string
      spentDate: Date
      hours: Prisma.Decimal
      notes: string | null
      status: string
      isLocked: boolean
      createdAt: Date
      updatedAt: Date
      project: { name: string; client: { id: string; name: string } }
      projectTask: { task: { name: string } }
    },
  ) {
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
      isLocked: e.isLocked,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
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
        throw new BadRequestException('该用户非本组织成员')
      }
    }

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
      items: items.map((e) => this.serializeEntry(e)),
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
      throw new ForbiddenException('您未被分配该项目，不能填报工时')
    }

    if (body.hours === 0) {
      const found = await this.prisma.timeEntry.findUnique({
        where: {
          userId_projectTaskId_spentDate: {
            userId: user.userId,
            projectTaskId: body.projectTaskId,
            spentDate: dayStart,
          },
        },
      })
      if (!found) {
        return { action: 'noop' as const, removed: false as const }
      }
      if (found.isLocked) {
        throw new ConflictException('该工时已锁定，无法删除或清空')
      }
      await this.prisma.timeEntry.delete({ where: { id: found.id } })
      return { action: 'deleted' as const, removed: true as const, id: found.id }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.findUnique({
        where: {
          userId_projectTaskId_spentDate: {
            userId: user.userId,
            projectTaskId: body.projectTaskId,
            spentDate: dayStart,
          },
        },
      })
      if (row?.isLocked) {
        throw new ConflictException('该工时已锁定，不能修改')
      }
      const saved = await tx.timeEntry.upsert({
        where: {
          userId_projectTaskId_spentDate: {
            userId: user.userId,
            projectTaskId: body.projectTaskId,
            spentDate: dayStart,
          },
        },
        create: {
          userId: user.userId,
          projectId: pt.projectId,
          projectTaskId: body.projectTaskId,
          spentDate: dayStart,
          hours: toDecimal(body.hours),
          notes: body.notes ?? null,
        },
        update: {
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
      return saved
    })
    return { action: 'saved' as const, item: this.serializeEntry(result) }
  }

  async update(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    id: string,
    body: UpdateTimeEntryDto,
  ) {
    if (body.hours === undefined && body.notes === undefined) {
      throw new BadRequestException('无更新字段')
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
      throw new NotFoundException('未找到记录')
    }
    if (row.isLocked) {
      throw new ConflictException('已锁定，无法编辑')
    }
    if (body.hours !== undefined && body.hours === 0) {
      await this.prisma.timeEntry.delete({ where: { id } })
      return { action: 'deleted' as const, id }
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
      throw new NotFoundException('未找到记录')
    }
    if (row.isLocked) {
      throw new ConflictException('已锁定，无法删除')
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
    const orgId = membership.organizationId

    const r = await this.prisma.timeEntry.updateMany({
      where: {
        userId: user.userId,
        isLocked: false,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
      },
      data: {
        isLocked: true,
        status: 'SUBMITTED',
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
      throw new ForbiddenException('仅管理员或经理可撤回已提交/已批准的工时周')
    }
    const dayStart = utcDayStart(body.weekOf)
    const from = startOfIsoWeekFromUtcDate(dayStart)
    const toExclusive = addUtcDays(from, 7)
    const orgId = membership.organizationId
    const r = await this.prisma.timeEntry.updateMany({
      where: {
        userId: user.userId,
        isLocked: true,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
      },
      data: {
        isLocked: false,
        status: 'UNSUBMITTED',
      },
    })
    return { unlockedCount: r.count, weekFrom: from.toISOString(), toExclusive: toExclusive.toISOString() }
  }

  async approve(
    membership: ActiveMembership,
    id: string,
  ) {
    if (!this.isElevatedRole(membership.systemRole)) {
      throw new ForbiddenException('仅管理员或经理可审批')
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
      throw new NotFoundException('未找到记录')
    }
    if (!row.isLocked) {
      throw new BadRequestException('需先提交锁定后再审批')
    }
    if (row.status === 'APPROVED') {
      return { item: this.serializeEntry(row) }
    }
    const u = await this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'APPROVED' },
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
    return { item: this.serializeEntry(u) }
  }
}

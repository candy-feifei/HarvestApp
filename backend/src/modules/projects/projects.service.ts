import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { PrismaService } from '../../prisma/prisma.service'
import {
  getSkipTake,
  toPaginatedResult,
} from '../../common/utils/pagination.util'
import { OrganizationContextService } from '../organization/organization-context.service'
import type { ProjectAssignmentLineDto } from './dto/project-assignment-line.dto'
import type { ProjectTaskLineDto } from './dto/project-task-line.dto'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

function toDecimal(
  n: number | null | undefined,
): Prisma.Decimal | null | undefined {
  if (n == null) return n === null ? null : undefined
  return new Prisma.Decimal(n)
}

function toIso(d: Date | null) {
  return d ? d.toISOString() : null
}

function toNum(
  d: Prisma.Decimal | null,
): number | null {
  if (d == null) return null
  return d.toNumber()
}

const projectDetailInclude = {
  client: { select: { id: true, name: true } },
  projectTasks: {
    include: {
      task: { select: { name: true } },
    },
  },
  assignments: {
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
} as const

type ProjectDetail = Prisma.ProjectGetPayload<{
  include: typeof projectDetailInclude
}>

function sanitizeMetadataInput(
  m: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (m == null) {
    return Prisma.JsonNull
  }
  const { tasks: _a, team: _b, ...rest } = m
  if (Object.keys(rest).length === 0) {
    return Prisma.JsonNull
  }
  return rest as Prisma.InputJsonValue
}

function metadataForApi(raw: Prisma.JsonValue | null) {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }
  const { tasks: _t, team: _g, ...rest } = raw as Record<string, unknown>
  if (Object.keys(rest).length === 0) {
    return null
  }
  return rest
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgContext: OrganizationContextService,
  ) {}

  private toApiProject(
    p: Prisma.ProjectGetPayload<{
      include: { client: { select: { id: true, name: true } } }
    }> & {
      projectTasks?: ProjectDetail['projectTasks']
      assignments?: ProjectDetail['assignments']
    },
  ) {
    const rawMeta = (p.metadata as Record<string, unknown> | null) ?? null
    const spentRaw =
      rawMeta && typeof rawMeta.spentAmount === 'number'
        ? rawMeta.spentAmount
        : 0
    const costsRaw =
      rawMeta && typeof rawMeta.costsAmount === 'number'
        ? rawMeta.costsAmount
        : 0

    const fromRelTasks =
      p.projectTasks?.map((pt) => ({
        taskId: pt.taskId,
        name: pt.task.name,
        isBillable: pt.isBillable,
        hourlyRate: toNum(pt.hourlyRate) ?? 0,
      })) ?? []
    const fromRelTeam =
      p.assignments?.map((a) => ({
        userId: a.userId,
        name: `${a.user.firstName} ${a.user.lastName}`.trim() || a.user.email,
        isManager: a.isManager,
        billableRate: toNum(a.projectBillableRate) ?? 0,
      })) ?? []
    const legacyTasks = Array.isArray(rawMeta?.tasks) ? rawMeta.tasks : []
    const legacyTeam = Array.isArray(rawMeta?.team) ? rawMeta.team : []
    const tasks = fromRelTasks.length > 0 ? fromRelTasks : legacyTasks
    const team = fromRelTeam.length > 0 ? fromRelTeam : legacyTeam

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      isBillable: p.isBillable,
      billingMethod: p.billingMethod,
      hourlyRate: toNum(p.hourlyRate),
      fixedFee: toNum(p.fixedFee),
      budgetType: p.budgetType,
      budgetAmount: toNum(p.budgetAmount),
      notifyAt: p.notifyAt,
      isArchived: p.isArchived,
      isPinned: p.isPinned,
      startsOn: toIso(p.startsOn),
      endsOn: toIso(p.endsOn),
      notes: p.notes,
      metadata: metadataForApi(p.metadata),
      clientId: p.client.id,
      clientName: p.client.name,
      organizationId: p.organizationId,
      spentAmount: spentRaw,
      costsAmount: costsRaw,
      tasks,
      team,
    }
  }

  private async assertTaskIdsInOrg(organizationId: string, taskIds: string[]) {
    const unique = [...new Set(taskIds)]
    if (unique.length === 0) {
      return
    }
    const n = await this.prisma.task.count({
      where: { id: { in: unique }, organizationId, isArchived: false },
    })
    if (n !== unique.length) {
      throw new BadRequestException('部分任务无效或不属于本组织')
    }
  }

  private async assertUserIdsInOrg(organizationId: string, userIds: string[]) {
    const unique = [...new Set(userIds)]
    if (unique.length === 0) {
      return
    }
    const n = await this.prisma.userOrganization.count({
      where: {
        organizationId,
        userId: { in: unique },
        status: 'ACTIVE',
      },
    })
    if (n !== unique.length) {
      throw new BadRequestException('部分成员无效或不属于本组织')
    }
  }

  private async syncProjectTasks(
    projectId: string,
    lines: ProjectTaskLineDto[],
  ) {
    const wanted = new Set(lines.map((l) => l.taskId))
    const existing = await this.prisma.projectTask.findMany({
      where: { projectId },
    })
    const byTask = new Map(existing.map((e) => [e.taskId, e]))

    for (const line of lines) {
      const cur = byTask.get(line.taskId)
      if (cur) {
        await this.prisma.projectTask.update({
          where: { id: cur.id },
          data: {
            isBillable: line.isBillable,
            hourlyRate: toDecimal(line.hourlyRate) ?? null,
          },
        })
      } else {
        await this.prisma.projectTask.create({
          data: {
            projectId,
            taskId: line.taskId,
            isBillable: line.isBillable,
            hourlyRate: toDecimal(line.hourlyRate) ?? null,
          },
        })
      }
    }
    for (const row of existing) {
      if (wanted.has(row.taskId)) {
        continue
      }
      const tc = await this.prisma.timeEntry.count({
        where: { projectTaskId: row.id },
      })
      if (tc > 0) {
        throw new BadRequestException(
          '无法从项目移除已用于记工时的任务。请先调整相关工时或保留该任务。',
        )
      }
      await this.prisma.projectTask.delete({ where: { id: row.id } })
    }
  }

  private async syncProjectAssignments(
    projectId: string,
    lines: ProjectAssignmentLineDto[],
  ) {
    await this.prisma.projectAssignment.deleteMany({ where: { projectId } })
    if (lines.length === 0) {
      return
    }
    await this.prisma.projectAssignment.createMany({
      data: lines.map((a) => ({
        projectId,
        userId: a.userId,
        isManager: a.isManager,
        projectBillableRate: toDecimal(a.projectBillableRate) ?? null,
        projectCostRate: toDecimal(a.projectCostRate) ?? null,
      })),
    })
  }

  async listProjectsPaginated(
    page: number,
    pageSize: number,
    actor: CurrentUserPayload,
    xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      actor.userId,
      xOrganizationId,
    )
    const orgId = m.organizationId
    const { skip, take } = getSkipTake(page, pageSize)
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId: orgId },
        skip,
        take,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        include: { client: { select: { id: true, name: true } } },
      }),
      this.prisma.project.count({ where: { organizationId: orgId } }),
    ])
    return toPaginatedResult(
      data.map((row) => this.toApiProject(row)),
      page,
      pageSize,
      total,
    )
  }

  async getById(
    id: string,
    actor: CurrentUserPayload,
    xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      actor.userId,
      xOrganizationId,
    )
    const p = await this.prisma.project.findFirst({
      where: { id, organizationId: m.organizationId },
      include: projectDetailInclude,
    })
    if (!p) {
      throw new NotFoundException('项目不存在或无权访问')
    }
    return this.toApiProject(p)
  }

  async create(
    user: CurrentUserPayload,
    xOrganizationId: string | undefined,
    dto: CreateProjectDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        organizationId: m.organizationId,
        isArchived: false,
      },
    })
    if (!client) {
      throw new NotFoundException('未找到该客户或无权操作')
    }

    const taskLines = dto.tasks ?? []
    const assignLines = dto.assignments ?? []
    if (taskLines.length > 0) {
      await this.assertTaskIdsInOrg(
        m.organizationId,
        taskLines.map((t) => t.taskId),
      )
    }
    if (assignLines.length > 0) {
      await this.assertUserIdsInOrg(
        m.organizationId,
        assignLines.map((a) => a.userId),
      )
    }

    const data: Prisma.ProjectCreateInput = {
      name: dto.name,
      code: dto.code,
      isBillable: dto.isBillable ?? true,
      billingMethod: dto.billingMethod,
      hourlyRate: toDecimal(dto.hourlyRate),
      fixedFee: toDecimal(dto.fixedFee),
      budgetType: dto.budgetType,
      budgetAmount: toDecimal(dto.budgetAmount),
      notifyAt: dto.notifyAt,
      isArchived: dto.isArchived ?? false,
      isPinned: dto.isPinned ?? false,
      startsOn: dto.startsOn ? new Date(dto.startsOn) : null,
      endsOn: dto.endsOn ? new Date(dto.endsOn) : null,
      notes: dto.notes,
      metadata: sanitizeMetadataInput(
        dto.metadata as Record<string, unknown> | undefined,
      ) as Prisma.InputJsonValue,
      client: { connect: { id: dto.clientId } },
      organization: { connect: { id: m.organizationId } },
      projectTasks:
        taskLines.length > 0
          ? {
              create: taskLines.map((t) => ({
                taskId: t.taskId,
                isBillable: t.isBillable,
                hourlyRate: toDecimal(t.hourlyRate) ?? null,
              })),
            }
          : undefined,
      assignments:
        assignLines.length > 0
          ? {
              create: assignLines.map((a) => ({
                userId: a.userId,
                isManager: a.isManager,
                projectBillableRate: toDecimal(a.projectBillableRate) ?? null,
                projectCostRate: toDecimal(a.projectCostRate) ?? null,
              })),
            }
          : undefined,
    }

    const p = await this.prisma.project.create({
      data,
      include: projectDetailInclude,
    })
    return this.toApiProject(p)
  }

  async update(
    user: CurrentUserPayload,
    xOrganizationId: string | undefined,
    id: string,
    dto: UpdateProjectDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId: m.organizationId },
    })
    if (!existing) {
      throw new NotFoundException('项目不存在或无权访问')
    }
    if (dto.clientId != null && dto.clientId !== existing.clientId) {
      const c = await this.prisma.client.findFirst({
        where: {
          id: dto.clientId,
          organizationId: m.organizationId,
          isArchived: false,
        },
      })
      if (!c) {
        throw new NotFoundException('未找到该客户或无权操作')
      }
    }

    const u: Prisma.ProjectUpdateInput = {}
    if (dto.name != null) u.name = dto.name
    if (dto.code !== undefined) u.code = dto.code
    if (dto.isBillable != null) u.isBillable = dto.isBillable
    if (dto.billingMethod != null) u.billingMethod = dto.billingMethod
    if (dto.hourlyRate !== undefined) u.hourlyRate = toDecimal(dto.hourlyRate)
    if (dto.fixedFee !== undefined) u.fixedFee = toDecimal(dto.fixedFee)
    if (dto.budgetType != null) u.budgetType = dto.budgetType
    if (dto.budgetAmount !== undefined) u.budgetAmount = toDecimal(dto.budgetAmount)
    if (dto.notifyAt !== undefined) u.notifyAt = dto.notifyAt
    if (dto.isArchived != null) u.isArchived = dto.isArchived
    if (dto.isPinned != null) u.isPinned = dto.isPinned
    if (dto.startsOn !== undefined) {
      u.startsOn = dto.startsOn ? new Date(dto.startsOn) : null
    }
    if (dto.endsOn !== undefined) u.endsOn = dto.endsOn ? new Date(dto.endsOn) : null
    if (dto.notes !== undefined) u.notes = dto.notes
    if (dto.metadata !== undefined) {
      u.metadata = sanitizeMetadataInput(
        dto.metadata as Record<string, unknown> | null,
      ) as Prisma.InputJsonValue
    }
    if (dto.clientId != null) u.client = { connect: { id: dto.clientId } }

    await this.prisma.project.update({
      where: { id },
      data: u,
    })

    if (dto.tasks !== undefined) {
      if (dto.tasks.length > 0) {
        await this.assertTaskIdsInOrg(
          m.organizationId,
          dto.tasks.map((t) => t.taskId),
        )
      }
      await this.syncProjectTasks(id, dto.tasks)
    }
    if (dto.assignments !== undefined) {
      if (dto.assignments.length > 0) {
        await this.assertUserIdsInOrg(
          m.organizationId,
          dto.assignments.map((a) => a.userId),
        )
      }
      await this.syncProjectAssignments(id, dto.assignments)
    }

    const full = await this.prisma.project.findFirst({
      where: { id },
      include: projectDetailInclude,
    })
    if (!full) {
      throw new NotFoundException('项目不存在或无权访问')
    }
    return this.toApiProject(full)
  }

  async remove(
    user: CurrentUserPayload,
    xOrganizationId: string | undefined,
    id: string,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId: m.organizationId },
    })
    if (!existing) {
      throw new NotFoundException('项目不存在或无权访问')
    }
    try {
      await this.prisma.project.delete({ where: { id } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError
        && e.code === 'P2003'
      ) {
        throw new BadRequestException('该项目仍有关联数据，无法删除。可先归档。')
      }
      throw e
    }
    return { id }
  }
}

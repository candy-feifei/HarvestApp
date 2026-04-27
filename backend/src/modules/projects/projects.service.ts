import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InvoiceDueMode, Prisma } from '@prisma/client'
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

function projectInvoiceDueModeToUi(
  mode: InvoiceDueMode,
  netDays: number | null,
) {
  if (mode === 'UPON_RECEIPT') {
    return 'upon_receipt' as const
  }
  const d = netDays ?? 30
  if (d <= 15) return 'net_15' as const
  if (d <= 30) return 'net_30' as const
  if (d <= 45) return 'net_45' as const
  return 'net_60' as const
}

function sanitizeMetadataInput(
  m: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (m == null) {
    return Prisma.JsonNull
  }
  const { tasks: _a, team: _b, invoice: _c, ...rest } = m
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
  const { tasks: _t, team: _g, invoice: _i, ...rest } = raw as Record<string, unknown>
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
    overrides?: {
      spentAmount?: number
      costsAmount?: number
    },
  ) {
    const rawMeta = (p.metadata as Record<string, unknown> | null) ?? null

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
      spentAmount: overrides?.spentAmount ?? 0,
      costsAmount: overrides?.costsAmount ?? 0,
      tasks,
      team,
      invoice: {
        dueMode: projectInvoiceDueModeToUi(p.invoiceDueMode, p.invoiceNetDays),
        poNumber: p.invoicePoNumber ?? '',
        taxPercent: toNum(p.invoiceTaxPercent) ?? 0,
        secondTaxEnabled: p.invoiceSecondTaxEnabled,
        secondTaxPercent: toNum(p.invoiceSecondTaxPercent) ?? 0,
        discountPercent: toNum(p.invoiceDiscountPercent) ?? 0,
      },
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

    const projectIds = data.map((p) => p.id)
    const spentAndCostsByProjectId =
      projectIds.length === 0
        ? new Map<string, { spent: number; costs: number }>()
        : new Map<string, { spent: number; costs: number }>(
            (
              await this.prisma.$queryRaw<
                Array<{
                  projectId: string
                  spent: Prisma.Decimal | null
                  costs: Prisma.Decimal | null
                }>
              >(Prisma.sql`
                SELECT
                  te."projectId" as "projectId",
                  COALESCE(SUM(te."hours"), 0) as "spent",
                  COALESCE(SUM(
                    te."hours" * COALESCE(
                      pa."projectCostRate",
                      rh."costRate",
                      0
                    )
                  ), 0) as "costs"
                FROM "time_entries" te
                JOIN "projects" p ON p."id" = te."projectId"
                LEFT JOIN "project_assignments" pa
                  ON pa."projectId" = te."projectId"
                  AND pa."userId" = te."userId"
                LEFT JOIN "user_organizations" uo
                  ON uo."userId" = te."userId"
                  AND uo."organizationId" = p."organizationId"
                LEFT JOIN LATERAL (
                  SELECT r."costRate"
                  FROM "rate_histories" r
                  WHERE r."userOrganizationId" = uo."id"
                    AND r."startDate" <= te."spentDate"
                  ORDER BY r."startDate" DESC
                  LIMIT 1
                ) rh ON true
                WHERE te."projectId" IN (${Prisma.join(projectIds)})
                GROUP BY te."projectId"
              `)
            ).map((r) => [
              r.projectId,
              { spent: toNum(r.spent) ?? 0, costs: toNum(r.costs) ?? 0 },
            ]),
          )

    const expenseCostsByProjectId =
      projectIds.length === 0
        ? new Map<string, number>()
        : new Map<string, number>(
            (
              await this.prisma.expense.groupBy({
                by: ['projectId'],
                where: { projectId: { in: projectIds } },
                _sum: { amount: true },
              })
            ).map((r) => [r.projectId, toNum(r._sum.amount) ?? 0]),
          )

    return toPaginatedResult(
      data.map((row) =>
        this.toApiProject(row, {
          spentAmount: spentAndCostsByProjectId.get(row.id)?.spent ?? 0,
          costsAmount:
            (spentAndCostsByProjectId.get(row.id)?.costs ?? 0)
            + (expenseCostsByProjectId.get(row.id) ?? 0),
        }),
      ),
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
    const agg = await this.prisma.$queryRaw<
      Array<{ spent: Prisma.Decimal | null; costs: Prisma.Decimal | null }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(te."hours"), 0) as "spent",
        COALESCE(SUM(
          te."hours" * COALESCE(
            pa."projectCostRate",
            rh."costRate",
            0
          )
        ), 0) as "costs"
      FROM "time_entries" te
      JOIN "projects" p ON p."id" = te."projectId"
      LEFT JOIN "project_assignments" pa
        ON pa."projectId" = te."projectId"
        AND pa."userId" = te."userId"
      LEFT JOIN "user_organizations" uo
        ON uo."userId" = te."userId"
        AND uo."organizationId" = p."organizationId"
      LEFT JOIN LATERAL (
        SELECT r."costRate"
        FROM "rate_histories" r
        WHERE r."userOrganizationId" = uo."id"
          AND r."startDate" <= te."spentDate"
        ORDER BY r."startDate" DESC
        LIMIT 1
      ) rh ON true
      WHERE te."projectId" = ${id}
    `)
    const row = agg[0]
    const expenseAgg = await this.prisma.expense.aggregate({
      where: { projectId: id },
      _sum: { amount: true },
    })
    return this.toApiProject(p, {
      spentAmount: toNum(row?.spent ?? null) ?? 0,
      costsAmount:
        (toNum(row?.costs ?? null) ?? 0)
        + (toNum(expenseAgg._sum.amount) ?? 0),
    })
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
      invoiceDueMode: dto.invoiceDueMode ?? 'UPON_RECEIPT',
      invoiceNetDays:
        (dto.invoiceDueMode ?? 'UPON_RECEIPT') === 'NET_DAYS'
          ? (dto.invoiceNetDays ?? 30)
          : null,
      invoicePoNumber: dto.invoicePoNumber,
      invoiceTaxPercent: toDecimal(dto.invoiceTaxPercent) ?? null,
      invoiceSecondTaxEnabled: dto.invoiceSecondTaxEnabled ?? false,
      invoiceSecondTaxPercent:
        (dto.invoiceSecondTaxEnabled ?? false)
          ? toDecimal(dto.invoiceSecondTaxPercent) ?? null
          : null,
      invoiceDiscountPercent: toDecimal(dto.invoiceDiscountPercent) ?? null,
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

    const assignedUserIds = new Set(assignLines.map((a) => a.userId))
    const auto = await this.prisma.userOrganization.findMany({
      where: {
        organizationId: m.organizationId,
        status: 'ACTIVE',
        assignAllFutureProjects: true,
      },
      select: { userId: true },
    })
    const extraUserIds = auto
      .map((r) => r.userId)
      .filter((uid) => !assignedUserIds.has(uid))
    if (extraUserIds.length > 0) {
      await this.prisma.projectAssignment.createMany({
        data: extraUserIds.map((userId) => ({
          projectId: p.id,
          userId,
          isManager: false,
        })),
        skipDuplicates: true,
      })
    }

    const full = await this.prisma.project.findFirst({
      where: { id: p.id },
      include: projectDetailInclude,
    })
    if (!full) {
      return this.toApiProject(p)
    }
    return this.toApiProject(full)
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
    if (dto.invoiceDueMode !== undefined) {
      u.invoiceDueMode = dto.invoiceDueMode
      u.invoiceNetDays =
        dto.invoiceDueMode === 'NET_DAYS'
          ? (dto.invoiceNetDays ?? existing.invoiceNetDays ?? 30)
          : null
    } else if (dto.invoiceNetDays !== undefined) {
      u.invoiceNetDays =
        existing.invoiceDueMode === 'NET_DAYS' ? dto.invoiceNetDays : null
    }
    if (dto.invoicePoNumber !== undefined) u.invoicePoNumber = dto.invoicePoNumber
    if (dto.invoiceTaxPercent !== undefined) {
      u.invoiceTaxPercent = toDecimal(dto.invoiceTaxPercent) ?? null
    }
    if (dto.invoiceSecondTaxEnabled !== undefined) {
      u.invoiceSecondTaxEnabled = dto.invoiceSecondTaxEnabled
      if (!dto.invoiceSecondTaxEnabled) u.invoiceSecondTaxPercent = null
    }
    if (dto.invoiceSecondTaxPercent !== undefined) {
      const enabled =
        dto.invoiceSecondTaxEnabled ??
        (existing as { invoiceSecondTaxEnabled?: boolean }).invoiceSecondTaxEnabled ??
        false
      u.invoiceSecondTaxPercent = enabled
        ? toDecimal(dto.invoiceSecondTaxPercent) ?? null
        : null
    }
    if (dto.invoiceDiscountPercent !== undefined) {
      u.invoiceDiscountPercent = toDecimal(dto.invoiceDiscountPercent) ?? null
    }
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

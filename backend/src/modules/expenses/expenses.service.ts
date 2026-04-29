import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ListExpenseQueryDto } from './dto/list-expense-query.dto'
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto'
import { UpdateExpenseDto } from './dto/update-expense.dto'
import { SubmitWeekDto } from '../time-entries/dto/submit-week.dto'

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

function isoWeekExclusiveEndUtc(weekMonday: Date): Date {
  return addUtcDays(weekMonday, 7)
}

function d(v: Prisma.Decimal | null | undefined): string | null {
  if (v == null) return null
  return v.toString()
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProjectInOrg(
    orgId: string,
    projectId: string,
  ): Promise<void> {
    const p = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    })
    if (!p) {
      throw new BadRequestException(
        'Project not found or not in the current organization',
      )
    }
  }

  private async assertCategoryInOrg(
    orgId: string,
    categoryId: string,
  ): Promise<void> {
    const c = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId: orgId },
    })
    if (!c) {
      throw new BadRequestException(
        'Expense category not found or not in the current organization',
      )
    }
  }

  private async assertUserInOrg(
    orgId: string,
    userId: string,
  ): Promise<void> {
    const m = await this.prisma.userOrganization.findFirst({
      where: { organizationId: orgId, userId, status: 'ACTIVE' },
    })
    if (!m) {
      throw new BadRequestException('User is not a member of this organization')
    }
  }

  async getFormOptions(membership: ActiveMembership) {
    const orgId = membership.organizationId
    const [projects, categories] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId: orgId, isArchived: false },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
        },
      }),
      this.prisma.expenseCategory.findMany({
        where: { organizationId: orgId, isArchived: false },
        orderBy: { name: 'asc' },
      }),
    ])
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.client.name,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        unitName: c.unitName,
        unitPrice: d(c.unitPrice),
        isArchived: c.isArchived,
      })),
      defaultCurrency: membership.organization.defaultCurrency,
    }
  }

  async list(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    query: ListExpenseQueryDto,
  ) {
    const orgId = membership.organizationId
    const includeAll = query.includeAllMembers === true
    const targetUserId = includeAll
      ? undefined
      : (query.userId ?? user.userId)
    if (targetUserId) {
      await this.assertUserInOrg(orgId, targetUserId)
    }

    const where: Prisma.ExpenseWhereInput = {
      project: { organizationId: orgId },
    }
    if (targetUserId) {
      where.userId = targetUserId
    }
    if (query.from || query.to) {
      where.spentDate = {}
      if (query.from) where.spentDate.gte = new Date(query.from)
      if (query.to) {
        const t = new Date(query.to)
        t.setHours(23, 59, 59, 999)
        where.spentDate.lte = t
      }
    }

    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ spentDate: 'desc' }, { id: 'desc' }],
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        category: true,
        approval: {
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    })

    return {
      items: rows.map((e) => this.toExpenseItem(e)),
    }
  }

  private toExpenseItem(
    e: {
      id: string
      amount: Prisma.Decimal
      spentDate: Date
      notes: string | null
      receiptUrl: string | null
      status: string
      isLocked: boolean
      isBillable: boolean
      isReimbursable: boolean
      unitQuantity: Prisma.Decimal | null
      user: {
        id: string
        firstName: string
        lastName: string
        email: string
      }
      project: {
        id: string
        name: string
        client: { id: string; name: string }
      }
      category: {
        id: string
        name: string
        unitName: string | null
        unitPrice: Prisma.Decimal | null
      }
      approval: {
        id: string
        status: string
        periodStart: Date
        periodEnd: Date
      } | null
    },
  ) {
    return {
      id: e.id,
      amount: d(e.amount)!,
      spentDate: e.spentDate.toISOString(),
      notes: e.notes,
      receiptUrl: e.receiptUrl,
      status: e.status,
      isLocked: e.isLocked,
      isBillable: e.isBillable,
      isReimbursable: e.isReimbursable,
      unitQuantity: d(e.unitQuantity),
      user: {
        id: e.user.id,
        firstName: e.user.firstName,
        lastName: e.user.lastName,
        email: e.user.email,
      },
      project: {
        id: e.project.id,
        name: e.project.name,
        client: e.project.client,
      },
      category: {
        id: e.category.id,
        name: e.category.name,
        unitName: e.category.unitName,
        unitPrice: d(e.category.unitPrice),
      },
      approval: e.approval
        ? {
            id: e.approval.id,
            status: e.approval.status,
            periodStart: e.approval.periodStart.toISOString(),
            periodEnd: e.approval.periodEnd.toISOString(),
          }
        : null,
    }
  }

  async create(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    dto: CreateExpenseDto,
  ) {
    const orgId = membership.organizationId
    await this.assertProjectInOrg(orgId, dto.projectId)
    await this.assertCategoryInOrg(orgId, dto.categoryId)
    const row = await this.prisma.expense.create({
      data: {
        spentDate: new Date(dto.spentDate),
        amount: dto.amount,
        notes: dto.notes,
        receiptUrl: dto.receiptUrl,
        isBillable: dto.isBillable ?? true,
        isReimbursable: dto.isReimbursable ?? false,
        unitQuantity:
          dto.unitQuantity != null
            ? new Prisma.Decimal(dto.unitQuantity)
            : null,
        userId: user.userId,
        projectId: dto.projectId,
        categoryId: dto.categoryId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        category: true,
        approval: {
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    })
    return this.toExpenseItem(row)
  }

  async update(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    id: string,
    dto: UpdateExpenseDto,
  ) {
    const e = await this.getOwnedExpenseInOrg(
      membership.organizationId,
      id,
      user.userId,
    )
    if (e.isLocked) {
      throw new ConflictException('This expense is locked and cannot be edited')
    }
    if (dto.projectId) {
      await this.assertProjectInOrg(membership.organizationId, dto.projectId)
    }
    if (dto.categoryId) {
      await this.assertCategoryInOrg(
        membership.organizationId,
        dto.categoryId,
      )
    }
    const row = await this.prisma.expense.update({
      where: { id },
      data: {
        spentDate: dto.spentDate ? new Date(dto.spentDate) : undefined,
        amount: dto.amount,
        notes: dto.notes,
        receiptUrl: dto.receiptUrl,
        isBillable: dto.isBillable,
        isReimbursable: dto.isReimbursable,
        unitQuantity:
          dto.unitQuantity === null
            ? null
            : dto.unitQuantity != null
              ? new Prisma.Decimal(dto.unitQuantity)
              : undefined,
        projectId: dto.projectId,
        categoryId: dto.categoryId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        category: true,
        approval: {
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    })
    return this.toExpenseItem(row)
  }

  /**
   * 与 Timesheet 周提交共用 approvals 周期：将本周期内未提交的 expense 标为 SUBMITTED 并挂到当前填报窗口。
   */
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

    let window = await this.prisma.approval.findFirst({
      where: {
        submitterId: user.userId,
        periodStart: { lte: from },
        periodEnd: { gte: weekLastDayStart },
      },
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
    })
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
        'This approval period is already approved; expenses for this week cannot be submitted again.',
      )
    }

    const outOfWindow = await this.prisma.expense.findFirst({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
        OR: [
          { spentDate: { lt: window.periodStart } },
          { spentDate: { gt: window.periodEnd } },
        ],
      },
      select: { id: true },
    })
    if (outOfWindow) {
      throw new BadRequestException(
        'Some expenses in this week fall outside the current approval period. Adjust dates and try again.',
      )
    }

    const r = await this.prisma.expense.updateMany({
      where: {
        userId: user.userId,
        project: { organizationId: orgId },
        spentDate: { gte: from, lt: toExclusive },
        status: 'UNSUBMITTED',
        isLocked: false,
      },
      data: {
        status: 'SUBMITTED',
        approvalId: window.id,
      },
    })
    return {
      submittedCount: r.count,
      weekFrom: from.toISOString(),
      toExclusive: toExclusive.toISOString(),
    }
  }

  async remove(
    membership: ActiveMembership,
    user: CurrentUserPayload,
    id: string,
  ) {
    const e = await this.getOwnedExpenseInOrg(
      membership.organizationId,
      id,
      user.userId,
    )
    if (e.isLocked) {
      throw new ConflictException('This expense is locked and cannot be deleted')
    }
    await this.prisma.expense.delete({ where: { id } })
    return { id }
  }

  private async getOwnedExpenseInOrg(
    orgId: string,
    expenseId: string,
    userId: string,
  ) {
    const e = await this.prisma.expense.findFirst({
      where: { id: expenseId, userId, project: { organizationId: orgId } },
    })
    if (!e) {
      throw new NotFoundException('Expense not found or access denied')
    }
    return e
  }

  async listCategories(membership: ActiveMembership) {
    const orgId = membership.organizationId
    const rows = await this.prisma.expenseCategory.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    })
    return {
      items: rows.map((c) => ({
        id: c.id,
        name: c.name,
        unitName: c.unitName,
        unitPrice: d(c.unitPrice),
        isArchived: c.isArchived,
        hasUnitPrice: c.unitName != null && c.unitPrice != null,
      })),
    }
  }

  async createCategory(
    membership: ActiveMembership,
    dto: CreateExpenseCategoryDto,
  ) {
    const hasUnit = dto.hasUnitPrice === true
    const row = await this.prisma.expenseCategory.create({
      data: {
        name: dto.name,
        unitName: hasUnit ? (dto.unitName?.trim() || 'mile') : null,
        unitPrice:
          hasUnit && dto.unitPrice != null
            ? new Prisma.Decimal(dto.unitPrice)
            : hasUnit
              ? new Prisma.Decimal(0)
              : null,
        organizationId: membership.organizationId,
      },
    })
    return {
      id: row.id,
      name: row.name,
      unitName: row.unitName,
      unitPrice: d(row.unitPrice),
      isArchived: row.isArchived,
    }
  }

  async updateCategory(
    membership: ActiveMembership,
    id: string,
    dto: UpdateExpenseCategoryDto,
  ) {
    const c = await this.prisma.expenseCategory.findFirst({
      where: { id, organizationId: membership.organizationId },
    })
    if (!c) throw new NotFoundException('Category not found')
    if (dto.hasUnitPrice === false) {
      dto.unitName = null
      dto.unitPrice = null
    } else if (dto.hasUnitPrice === true) {
      if (dto.unitName === undefined) dto.unitName = c.unitName ?? 'mile'
      if (dto.unitPrice === undefined && c.unitPrice == null) {
        dto.unitPrice = 0
      }
    }
    const row = await this.prisma.expenseCategory.update({
      where: { id },
      data: {
        name: dto.name,
        ...(dto.isArchived !== undefined
          ? { isArchived: dto.isArchived }
          : {}),
        unitName: dto.unitName,
        unitPrice:
          dto.unitPrice === null
            ? null
            : dto.unitPrice != null
              ? new Prisma.Decimal(dto.unitPrice)
              : undefined,
      },
    })
    return {
      id: row.id,
      name: row.name,
      unitName: row.unitName,
      unitPrice: d(row.unitPrice),
      isArchived: row.isArchived,
    }
  }

  async removeCategory(membership: ActiveMembership, id: string) {
    const c = await this.prisma.expenseCategory.findFirst({
      where: { id, organizationId: membership.organizationId },
    })
    if (!c) throw new NotFoundException('Category not found')
    if (c.isArchived) {
      return { id, removed: true as const }
    }
    try {
      await this.prisma.expenseCategory.delete({ where: { id } })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException(
          'This category still has linked expenses. Archive it or remove links first.',
        )
      }
      throw e
    }
    return { id, removed: true as const }
  }
}

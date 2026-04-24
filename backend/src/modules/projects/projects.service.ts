import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSkipTake,
  toPaginatedResult,
} from '../../common/utils/pagination.util';
import { OrganizationContextService } from '../organization/organization-context.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

function toDecimal(
  n: number | null | undefined,
): Prisma.Decimal | null | undefined {
  if (n == null) return n === null ? null : undefined;
  return new Prisma.Decimal(n);
}

function toIso(d: Date | null) {
  return d ? d.toISOString() : null;
}

function toNum(
  d: Prisma.Decimal | null,
): number | null {
  if (d == null) return null;
  return d.toNumber();
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgContext: OrganizationContextService,
  ) {}

  private toApiProject(
    p: Prisma.ProjectGetPayload<{
      include: { client: { select: { id: true; name: true } } };
    }>,
  ) {
    const meta = (p.metadata as Record<string, unknown> | null) ?? null
    const spentRaw =
      meta && typeof meta.spentAmount === 'number' ? meta.spentAmount : 0
    const costsRaw =
      meta && typeof meta.costsAmount === 'number' ? meta.costsAmount : 0
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
      metadata: p.metadata,
      clientId: p.client.id,
      clientName: p.client.name,
      organizationId: p.organizationId,
      spentAmount: spentRaw,
      costsAmount: costsRaw,
    }
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
    );
    const orgId = m.organizationId;
    const { skip, take } = getSkipTake(page, pageSize);
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId: orgId },
        skip,
        take,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        include: { client: { select: { id: true, name: true } } },
      }),
      this.prisma.project.count({ where: { organizationId: orgId } }),
    ]);
    return toPaginatedResult(
      data.map((row) => this.toApiProject(row)),
      page,
      pageSize,
      total,
    );
  }

  async getById(
    id: string,
    actor: CurrentUserPayload,
    xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      actor.userId,
      xOrganizationId,
    );
    const p = await this.prisma.project.findFirst({
      where: { id, organizationId: m.organizationId },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!p) {
      throw new NotFoundException('项目不存在或无权访问');
    }
    return this.toApiProject(p);
  }

  async create(
    user: CurrentUserPayload,
    xOrganizationId: string | undefined,
    dto: CreateProjectDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    );
    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        organizationId: m.organizationId,
        isArchived: false,
      },
    });
    if (!client) {
      throw new NotFoundException('未找到该客户或无权操作');
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
      metadata:
        dto.metadata == null
          ? Prisma.JsonNull
          : (dto.metadata as Prisma.InputJsonValue),
      client: { connect: { id: dto.clientId } },
      organization: { connect: { id: m.organizationId } },
    }

    const p = await this.prisma.project.create({
      data,
      include: { client: { select: { id: true, name: true } } },
    });
    return this.toApiProject(p);
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
    );
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId: m.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('项目不存在或无权访问');
    }
    if (dto.clientId != null && dto.clientId !== existing.clientId) {
      const c = await this.prisma.client.findFirst({
        where: {
          id: dto.clientId,
          organizationId: m.organizationId,
          isArchived: false,
        },
      });
      if (!c) {
        throw new NotFoundException('未找到该客户或无权操作');
      }
    }

    const u: Prisma.ProjectUpdateInput = {};
    if (dto.name != null) u.name = dto.name;
    if (dto.code !== undefined) u.code = dto.code;
    if (dto.isBillable != null) u.isBillable = dto.isBillable;
    if (dto.billingMethod != null) u.billingMethod = dto.billingMethod;
    if (dto.hourlyRate !== undefined) u.hourlyRate = toDecimal(dto.hourlyRate);
    if (dto.fixedFee !== undefined) u.fixedFee = toDecimal(dto.fixedFee);
    if (dto.budgetType != null) u.budgetType = dto.budgetType;
    if (dto.budgetAmount !== undefined) u.budgetAmount = toDecimal(dto.budgetAmount);
    if (dto.notifyAt !== undefined) u.notifyAt = dto.notifyAt;
    if (dto.isArchived != null) u.isArchived = dto.isArchived;
    if (dto.isPinned != null) u.isPinned = dto.isPinned;
    if (dto.startsOn !== undefined) {
      u.startsOn = dto.startsOn ? new Date(dto.startsOn) : null;
    }
    if (dto.endsOn !== undefined) u.endsOn = dto.endsOn ? new Date(dto.endsOn) : null;
    if (dto.notes !== undefined) u.notes = dto.notes;
    if (dto.metadata !== undefined) {
      u.metadata =
        dto.metadata == null
          ? Prisma.JsonNull
          : (dto.metadata as Prisma.InputJsonValue);
    }
    if (dto.clientId != null) u.client = { connect: { id: dto.clientId } };

    const p = await this.prisma.project.update({
      where: { id },
      data: u,
      include: { client: { select: { id: true, name: true } } },
    });
    return this.toApiProject(p);
  }

  async remove(
    user: CurrentUserPayload,
    xOrganizationId: string | undefined,
    id: string,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    );
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId: m.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('项目不存在或无权访问');
    }
    try {
      await this.prisma.project.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError
        && e.code === 'P2003'
      ) {
        throw new BadRequestException('该项目仍有关联数据，无法删除。可先归档。');
      }
      throw e
    }
    return { id };
  }
}

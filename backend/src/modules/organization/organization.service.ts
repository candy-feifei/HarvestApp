import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSkipTake,
  toPaginatedResult,
} from '../../common/utils/pagination.util';
import { AuthService } from '../auth/auth.service';
import { CreateMemberRateDto } from './dto/create-member-rate.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRateDto } from './dto/update-member-rate.dto';
import { CreateOrganizationRoleDto } from './dto/create-organization-role.dto';
import { ManagerPermissionsDto, UpdateMemberDto } from './dto/update-member.dto';
import { UpdateOrganizationRoleDto } from './dto/update-organization-role.dto';
import {
  SetMemberProjectAssignmentsDto,
} from './dto/member-project-assignments.dto';

const canInvite: SystemRole[] = ['ADMINISTRATOR', 'MANAGER'];
const canManageRates: SystemRole[] = ['ADMINISTRATOR', 'MANAGER'];
const canManageProjectAssignments: SystemRole[] = [
  'ADMINISTRATOR',
  'MANAGER',
];

const canChangeMemberSystemRole: SystemRole[] = ['ADMINISTRATOR'];

const DEFAULT_MGR_PERMS: ManagerPermissionsDto = {
  createEditManagedProjects: false,
  createEditAllClientsTasks: false,
  createEditTimeExpensesManaged: false,
  seeEditBillableRatesManaged: false,
  createEditDraftInvoices: false,
  manageAllInvoices: false,
  createEditAllEstimates: false,
  withdrawApprovals: false,
};

function parseManagerPermissions(
  json: Prisma.JsonValue | null,
  systemRole: SystemRole,
): ManagerPermissionsDto {
  if (
    systemRole !== 'MANAGER'
    || json == null
    || typeof json !== 'object'
    || Array.isArray(json)
  ) {
    return { ...DEFAULT_MGR_PERMS };
  }
  const o = json as Record<string, unknown>;
  return {
    createEditManagedProjects: Boolean(o.createEditManagedProjects),
    createEditAllClientsTasks: Boolean(o.createEditAllClientsTasks),
    createEditTimeExpensesManaged: Boolean(o.createEditTimeExpensesManaged),
    seeEditBillableRatesManaged: Boolean(o.seeEditBillableRatesManaged),
    createEditDraftInvoices: Boolean(o.createEditDraftInvoices),
    manageAllInvoices: Boolean(o.manageAllInvoices),
    createEditAllEstimates: Boolean(o.createEditAllEstimates),
    withdrawApprovals: Boolean(o.withdrawApprovals),
  };
}

/** YYYY-MM-DD -> UTC 当天 0:00 */
function utcDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function startOfIsoWeekFromUtcDate(ref: Date): Date {
  const w = ref.getUTCDay();
  const add = w === 0 ? -6 : 1 - w;
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
  );
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
  );
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ymdToUtcDayStart(ymd: string): Date {
  return utcDayStart(ymd);
}

function serializeRate(r: {
  id: string;
  billableRate: Prisma.Decimal;
  costRate: Prisma.Decimal;
  startDate: Date;
  endDate: Date | null;
}) {
  return {
    id: r.id,
    billableRatePerHour: Number(r.billableRate),
    costRatePerHour: Number(r.costRate),
    startDate: r.startDate.toISOString(),
    endDate: r.endDate ? r.endDate.toISOString() : null,
    isCurrent: r.endDate == null,
  };
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listUsersPaginated(page: number, pageSize: number) {
    const { skip, take } = getSkipTake(page, pageSize);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return toPaginatedResult(data, page, pageSize, total);
  }

  async listMembers(organizationId: string) {
    const rows = await this.prisma.userOrganization.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            invitationStatus: true,
          },
        },
        rateHistories: {
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { user: { lastName: 'asc' } },
        { user: { firstName: 'asc' } },
      ],
    });
    return {
      items: rows.map((r) => {
        const rate = r.rateHistories[0];
        return {
          memberId: r.id,
          userId: r.userId,
          systemRole: r.systemRole,
          email: r.user.email,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          invitationStatus: r.user.invitationStatus,
          weeklyCapacity: r.weeklyCapacity,
          employeeId: r.employeeId,
          employmentType: r.employmentType,
          jobLabel: r.jobLabel,
          defaultBillableRatePerHour: rate
            ? Number(rate.billableRate)
            : 0,
          costRatePerHour: rate ? Number(rate.costRate) : 0,
        };
      }),
    };
  }

  async inviteMember(
    organizationId: string,
    organizationName: string,
    inviterRole: string,
    dto: InviteMemberDto,
  ) {
    if (!canInvite.includes(inviterRole as SystemRole)) {
      throw new ForbiddenException('无权限邀请成员');
    }
    const email = dto.workEmail.toLowerCase().trim();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('请填写名与姓');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (targetUser) {
      const block = await this.prisma.userOrganization.findFirst({
        where: {
          userId: targetUser.id,
          organizationId,
          status: 'ACTIVE',
        },
      });
      if (block) {
        throw new ConflictException('该成员已在本组织中');
      }
    }

    const bill = new Prisma.Decimal(dto.defaultBillableRatePerHour ?? 0);
    const cost = new Prisma.Decimal(dto.costRatePerHour ?? 0);
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    const { userId, memberId } = await this.prisma.$transaction(
      async (tx) => {
        let user = targetUser;
        if (!user) {
          user = await tx.user.create({
            data: {
              email,
              firstName: firstName.slice(0, 120),
              lastName: lastName.slice(0, 120),
              invitationStatus: 'INVITED',
              invitedAt: new Date(),
            },
          });
        } else {
          await tx.user.update({
            where: { id: user.id },
            data: {
              firstName: firstName.slice(0, 120),
              lastName: lastName.slice(0, 120),
            },
          });
        }

        const uo = await tx.userOrganization.findUnique({
          where: {
            userId_organizationId: { userId: user.id, organizationId },
          },
        });

        const uoData = {
          weeklyCapacity: dto.weeklyCapacity,
          employeeId: dto.employeeId?.trim() || null,
          employmentType: dto.employmentType ?? 'EMPLOYEE',
          jobLabel: dto.jobLabel?.trim() || null,
        };

        if (uo) {
          if (uo.status === 'ACTIVE') {
            throw new ConflictException('该成员已在本组织中');
          }
          const updated = await tx.userOrganization.update({
            where: { id: uo.id },
            data: {
              ...uoData,
              status: 'ACTIVE',
              archivedAt: null,
              systemRole: 'MEMBER',
            },
          });
          await tx.rateHistory.create({
            data: {
              userOrganizationId: updated.id,
              billableRate: bill,
              costRate: cost,
              startDate,
            },
          });
          return { userId: user.id, memberId: updated.id };
        }

        const created = await tx.userOrganization.create({
          data: {
            userId: user.id,
            organizationId,
            systemRole: 'MEMBER',
            status: 'ACTIVE',
            ...uoData,
          },
        });
        await tx.rateHistory.create({
          data: {
            userOrganizationId: created.id,
            billableRate: bill,
            costRate: cost,
            startDate,
          },
        });
        return { userId: user.id, memberId: created.id };
      },
    );

    const { sent, setPasswordUrl } =
      await this.authService.sendTeamOnboardingEmail(userId, {
        organizationName,
      });
    return {
      userId,
      memberId,
      email,
      emailSent: sent,
      setPasswordUrl,
    };
  }

  async getTeamWeeklySummary(organizationId: string, week?: string) {
    const now = new Date();
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
    );
    const ref = week ? utcDayStart(week) : todayUtc;
    const from = startOfIsoWeekFromUtcDate(ref);
    const toExclusive = addUtcDays(from, 7);

    const members = await this.prisma.userOrganization.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            invitationStatus: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { user: { lastName: 'asc' } },
        { user: { firstName: 'asc' } },
      ],
    });

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        spentDate: { gte: from, lt: toExclusive },
        project: { organizationId },
      },
      select: {
        userId: true,
        hours: true,
        project: { select: { isBillable: true, billingMethod: true } },
        projectTask: { select: { isBillable: true } },
      },
    });

    const byUser = new Map<
      string,
      { hours: number; billableHours: number; nonBillableHours: number }
    >();

    for (const e of entries) {
      const hrs = Number(e.hours);
      const isBillable =
        e.project.isBillable &&
        e.project.billingMethod !== 'NON_BILLABLE' &&
        e.projectTask.isBillable;

      const agg =
        byUser.get(e.userId) ?? { hours: 0, billableHours: 0, nonBillableHours: 0 };
      agg.hours = round2(agg.hours + hrs);
      if (isBillable) {
        agg.billableHours = round2(agg.billableHours + hrs);
      } else {
        agg.nonBillableHours = round2(agg.nonBillableHours + hrs);
      }
      byUser.set(e.userId, agg);
    }

    const memberItems = members.map((m) => {
      const agg =
        byUser.get(m.userId) ?? { hours: 0, billableHours: 0, nonBillableHours: 0 };
      const capacity = m.weeklyCapacity ?? 0;
      const utilization = capacity > 0 ? round2((agg.hours / capacity) * 100) : 0;
      return {
        memberId: m.id,
        userId: m.userId,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        invitationStatus: m.user.invitationStatus,
        systemRole: m.systemRole,
        isPinned: m.isPinned,
        weeklyCapacity: capacity,
        hours: agg.hours,
        billableHours: agg.billableHours,
        nonBillableHours: agg.nonBillableHours,
        utilizationPercent: utilization,
      };
    });

    const totalHours = round2(memberItems.reduce((s, r) => s + r.hours, 0));
    const billableHours = round2(
      memberItems.reduce((s, r) => s + r.billableHours, 0),
    );
    const nonBillableHours = round2(totalHours - billableHours);
    const teamCapacity = members.reduce((s, r) => s + (r.weeklyCapacity ?? 0), 0);

    return {
      range: {
        weekOf: toYmd(from),
        from: from.toISOString(),
        toExclusive: toExclusive.toISOString(),
      },
      totals: {
        totalHours,
        billableHours,
        nonBillableHours,
        teamCapacity,
      },
      items: memberItems,
    };
  }

  async getMember(organizationId: string, memberId: string) {
    const row = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            invitationStatus: true,
            timezone: true,
          },
        },
        rateHistories: {
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!row) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }
    const rate = row.rateHistories[0];
    return {
      memberId: row.id,
      userId: row.userId,
      email: row.user.email,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      invitationStatus: row.user.invitationStatus,
      timezone: row.user.timezone,
      employeeId: row.employeeId ?? null,
      employmentType: row.employmentType,
      jobLabel: row.jobLabel ?? null,
      weeklyCapacity: row.weeklyCapacity ?? 0,
      systemRole: row.systemRole,
      managerPermissions: parseManagerPermissions(
        row.managerPermissions,
        row.systemRole,
      ),
      isPinned: row.isPinned,
      status: row.status,
      assignAllFutureProjects: row.assignAllFutureProjects,
      defaultBillableRatePerHour: rate ? Number(rate.billableRate) : 0,
      costRatePerHour: rate ? Number(rate.costRate) : 0,
    };
  }

  async getMemberProjectAssignments(
    organizationId: string,
    memberId: string,
    q?: string,
  ) {
    const uo = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        assignAllFutureProjects: true,
      },
    });
    if (!uo) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }

    const needle = q?.trim();
    const whereProject: Prisma.ProjectWhereInput = {
      organizationId,
      isArchived: false,
      ...(needle
        ? {
            OR: [
              { name: { contains: needle, mode: 'insensitive' } },
              { code: { contains: needle, mode: 'insensitive' } },
              {
                client: {
                  is: { name: { contains: needle, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    const projects = await this.prisma.project.findMany({
      where: whereProject,
      include: {
        client: { select: { id: true, name: true } },
        assignments: {
          where: { userId: uo.userId },
          select: { isManager: true },
          take: 1,
        },
      },
      orderBy: [{ client: { name: 'asc' } }, { name: 'asc' }],
    });

    const clientMap = new Map<
      string,
      {
        id: string;
        name: string;
        projects: {
          id: string;
          name: string;
          code: string | null;
          isAssigned: boolean;
          isManager: boolean;
        }[];
      }
    >();

    for (const p of projects) {
      const cid = p.client.id;
      if (!clientMap.has(cid)) {
        clientMap.set(cid, { id: cid, name: p.client.name, projects: [] });
      }
      const a = p.assignments[0];
      clientMap.get(cid)!.projects.push({
        id: p.id,
        name: p.name,
        code: p.code,
        isAssigned: Boolean(a),
        isManager: a?.isManager ?? false,
      });
    }

    return {
      memberId: uo.id,
      userId: uo.userId,
      assignAllFutureProjects: uo.assignAllFutureProjects,
      clients: [...clientMap.values()],
    };
  }

  async setMemberProjectAssignments(
    organizationId: string,
    actorRole: string,
    memberId: string,
    dto: SetMemberProjectAssignmentsDto,
  ) {
    if (!canManageProjectAssignments.includes(actorRole as SystemRole)) {
      throw new ForbiddenException('无权限分配项目');
    }

    const uo = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true, userId: true },
    });
    if (!uo) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }

    const lines = dto.assignments ?? [];
    const projectIds = lines.map((l) => l.projectId);
    if (new Set(projectIds).size !== projectIds.length) {
      throw new BadRequestException('项目分配列表含重复 projectId');
    }

    const projects = await this.prisma.project.findMany({
      where: {
        id: { in: projectIds },
        organizationId,
        isArchived: false,
      },
      select: { id: true },
    });
    if (projects.length !== projectIds.length) {
      throw new NotFoundException('部分项目不存在、已归档或不属于该组织');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.assignAllFutureProjects != null) {
        await tx.userOrganization.update({
          where: { id: uo.id },
          data: { assignAllFutureProjects: dto.assignAllFutureProjects },
        });
      }

      if (projectIds.length === 0) {
        await tx.projectAssignment.deleteMany({
          where: { userId: uo.userId },
        });
        return;
      }

      await tx.projectAssignment.deleteMany({
        where: { userId: uo.userId, projectId: { notIn: projectIds } },
      });

      for (const line of lines) {
        const isManager = line.isManager ?? false;
        await tx.projectAssignment.upsert({
          where: {
            projectId_userId: { projectId: line.projectId, userId: uo.userId },
          },
          create: {
            projectId: line.projectId,
            userId: uo.userId,
            isManager,
            projectBillableRate: null,
            projectCostRate: null,
          },
          update: { isManager },
        });
      }
    });

    return this.getMemberProjectAssignments(organizationId, memberId);
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberDto,
    actorSystemRole: string,
  ) {
    const row = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        systemRole: true,
      },
    });
    if (!row) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }

    if (dto.isPinned !== undefined) {
      if (!canInvite.includes(actorSystemRole as SystemRole)) {
        throw new ForbiddenException('无权限固定/取消固定成员');
      }
    }

    const touchesRole = dto.systemRole != null || dto.managerPermissions != null;
    if (
      touchesRole
      && !canChangeMemberSystemRole.includes(actorSystemRole as SystemRole)
    ) {
      throw new ForbiddenException('无权限修改成员角色与权限');
    }

    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    const email = dto.workEmail?.toLowerCase().trim();
    const tz = dto.timezone?.trim();

    const uoData: Prisma.UserOrganizationUpdateInput = {
      ...(dto.weeklyCapacity != null ? { weeklyCapacity: dto.weeklyCapacity } : {}),
      ...(dto.employeeId !== undefined
        ? { employeeId: dto.employeeId?.trim() || null }
        : {}),
      ...(dto.employmentType != null ? { employmentType: dto.employmentType } : {}),
      ...(dto.jobLabel !== undefined ? { jobLabel: dto.jobLabel?.trim() || null } : {}),
      ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
    };
    if (touchesRole) {
      if (dto.systemRole != null) uoData.systemRole = dto.systemRole;
      const nextRole = (dto.systemRole ?? row.systemRole) as SystemRole;
      if (nextRole === 'MANAGER') {
        if (dto.managerPermissions != null) {
          uoData.managerPermissions = {
            ...dto.managerPermissions,
          } as unknown as Prisma.InputJsonValue;
        } else if (dto.systemRole === 'MANAGER') {
          uoData.managerPermissions = {
            ...DEFAULT_MGR_PERMS,
          } as unknown as Prisma.InputJsonValue;
        }
      } else {
        uoData.managerPermissions = Prisma.JsonNull;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (email || firstName || lastName || tz) {
        const data: Prisma.UserUpdateInput = {};
        if (email) data.email = email;
        if (firstName) data.firstName = firstName.slice(0, 120);
        if (lastName) data.lastName = lastName.slice(0, 120);
        if (tz) data.timezone = tz.slice(0, 80);
        await tx.user.update({ where: { id: row.userId }, data });
      }

      if (Object.keys(uoData).length > 0) {
        await tx.userOrganization.update({ where: { id: row.id }, data: uoData });
      }
    });

    return this.getMember(organizationId, memberId);
  }

  async resendInvitation(
    organizationId: string,
    organizationName: string,
    inviterRole: string,
    memberId: string,
  ) {
    if (!canInvite.includes(inviterRole as SystemRole)) {
      throw new ForbiddenException('无权限重发邀请');
    }
    const row = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      include: { user: true },
    });
    if (!row) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }
    if (row.user.invitationStatus !== 'INVITED') {
      throw new BadRequestException('该成员已激活，无需重发邀请');
    }
    const { sent, setPasswordUrl } = await this.authService.sendTeamOnboardingEmail(
      row.userId,
      { organizationName },
    );
    return { email: row.user.email, emailSent: sent, setPasswordUrl };
  }

  async listMemberRates(organizationId: string, memberId: string) {
    const uo = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!uo) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }
    const rows = await this.prisma.rateHistory.findMany({
      where: { userOrganizationId: memberId },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    });
    return { items: rows.map(serializeRate) };
  }

  async createMemberRate(
    organizationId: string,
    actorRole: string,
    memberId: string,
    dto: CreateMemberRateDto,
  ) {
    if (!canManageRates.includes(actorRole as SystemRole)) {
      throw new ForbiddenException('无权限管理 rates');
    }
    const uo = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!uo) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }

    if (dto.billableRatePerHour == null && dto.costRatePerHour == null) {
      throw new BadRequestException('请至少填写 billable rate 或 cost rate 之一');
    }

    const start = dto.startDate
      ? ymdToUtcDayStart(dto.startDate)
      : (() => {
          const d = new Date();
          d.setUTCHours(0, 0, 0, 0);
          return d;
        })();

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.rateHistory.findFirst({
        where: { userOrganizationId: memberId, endDate: null },
        orderBy: { startDate: 'desc' },
      });

      const bill =
        dto.billableRatePerHour != null
          ? new Prisma.Decimal(dto.billableRatePerHour)
          : current?.billableRate ?? new Prisma.Decimal(0);
      const cost =
        dto.costRatePerHour != null
          ? new Prisma.Decimal(dto.costRatePerHour)
          : current?.costRate ?? new Prisma.Decimal(0);

      if (current) {
        await tx.rateHistory.update({
          where: { id: current.id },
          data: { endDate: start },
        });
      }

      return tx.rateHistory.create({
        data: {
          userOrganizationId: memberId,
          billableRate: bill,
          costRate: cost,
          startDate: start,
          endDate: null,
        },
      });
    });

    return { item: serializeRate(result) };
  }

  async updateMemberRate(
    organizationId: string,
    actorRole: string,
    memberId: string,
    rateId: string,
    dto: UpdateMemberRateDto,
  ) {
    if (!canManageRates.includes(actorRole as SystemRole)) {
      throw new ForbiddenException('无权限管理 rates');
    }
    const uo = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!uo) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }

    if (
      dto.billableRatePerHour == null &&
      dto.costRatePerHour == null &&
      dto.startDate == null
    ) {
      throw new BadRequestException('无更新字段');
    }

    const row = await this.prisma.rateHistory.findFirst({
      where: { id: rateId, userOrganizationId: memberId },
    });
    if (!row) {
      throw new BadRequestException('rate 不存在');
    }

    const newStart = dto.startDate
      ? ymdToUtcDayStart(dto.startDate)
      : null;

    const data: Prisma.RateHistoryUpdateInput = {
      ...(dto.billableRatePerHour != null
        ? { billableRate: new Prisma.Decimal(dto.billableRatePerHour) }
        : {}),
      ...(dto.costRatePerHour != null
        ? { costRate: new Prisma.Decimal(dto.costRatePerHour) }
        : {}),
      ...(newStart ? { startDate: newStart } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      if (newStart && newStart.getTime() !== row.startDate.getTime()) {
        const conflict = await tx.rateHistory.findFirst({
          where: {
            userOrganizationId: memberId,
            startDate: newStart,
            NOT: { id: row.id },
          },
        });
        if (conflict) {
          throw new BadRequestException('该开始日期已存在另一条费率记录');
        }

        const prev = await tx.rateHistory.findFirst({
          where: {
            userOrganizationId: memberId,
            endDate: row.startDate,
            NOT: { id: row.id },
          },
        });
        if (prev) {
          await tx.rateHistory.update({
            where: { id: prev.id },
            data: { endDate: newStart },
          });
        }
      }

      return tx.rateHistory.update({
        where: { id: row.id },
        data,
      });
    });

    return { item: serializeRate(updated) };
  }

  async deleteMemberRate(
    organizationId: string,
    actorRole: string,
    memberId: string,
    rateId: string,
  ) {
    if (!canManageRates.includes(actorRole as SystemRole)) {
      throw new ForbiddenException('无权限管理 rates');
    }
    const uo = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!uo) {
      throw new BadRequestException('成员不存在或不属于该组织');
    }
    const row = await this.prisma.rateHistory.findFirst({
      where: { id: rateId, userOrganizationId: memberId },
    });
    if (!row) {
      throw new BadRequestException('rate 不存在');
    }
    await this.prisma.rateHistory.delete({ where: { id: row.id } });
    return { deleted: true as const };
  }

  private async assertCanRemoveOrArchiveMember(
    organizationId: string,
    row: { id: string; userId: string; systemRole: SystemRole },
    actorUserId: string,
  ) {
    if (row.userId === actorUserId) {
      throw new BadRequestException('不能对本人执行此操作');
    }
    if (row.systemRole === 'ADMINISTRATOR') {
      const n = await this.prisma.userOrganization.count({
        where: {
          organizationId,
          status: 'ACTIVE',
          systemRole: 'ADMINISTRATOR',
        },
      });
      if (n <= 1) {
        throw new BadRequestException('组织至少需要一名激活的管理员');
      }
    }
  }

  /**
   * 软移除：仍保留 user_organizations 行，列表不再展示。
   */
  async archiveMember(
    organizationId: string,
    memberId: string,
    actorSystemRole: string,
    actorUserId: string,
  ) {
    if (!canInvite.includes(actorSystemRole as SystemRole)) {
      throw new ForbiddenException('无权限归档成员');
    }
    const row = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true, userId: true, systemRole: true },
    });
    if (!row) {
      throw new NotFoundException('成员不存在或已归档');
    }
    await this.assertCanRemoveOrArchiveMember(organizationId, row, actorUserId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.userOrganization.updateMany({
        where: { managerId: row.id },
        data: { managerId: null },
      });
      await tx.userOrganization.update({
        where: { id: row.id },
        data: {
          status: 'ARCHIVED',
          archivedAt: now,
          isPinned: false,
        },
      });
    });
    return { archived: true as const, memberId: row.id };
  }

  /**
   * 从本组织完全移除：删除 UO 及关联的 rate 历史、并去掉本组织项目的分配。
   * User 与历史工时等记录保留（按 userId）。
   */
  async removeMember(
    organizationId: string,
    memberId: string,
    actorSystemRole: string,
    actorUserId: string,
  ) {
    if (!canInvite.includes(actorSystemRole as SystemRole)) {
      throw new ForbiddenException('无权限移除此成员');
    }
    const row = await this.prisma.userOrganization.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      select: { id: true, userId: true, systemRole: true },
    });
    if (!row) {
      throw new NotFoundException('成员不存在或已归档');
    }
    await this.assertCanRemoveOrArchiveMember(organizationId, row, actorUserId);
    const userId = row.userId;
    await this.prisma.$transaction(async (tx) => {
      await tx.userOrganization.updateMany({
        where: { managerId: row.id },
        data: { managerId: null },
      });
      const projectIds = await tx.project.findMany({
        where: { organizationId },
        select: { id: true },
      });
      if (projectIds.length) {
        await tx.projectAssignment.deleteMany({
          where: {
            userId,
            projectId: { in: projectIds.map((p) => p.id) },
          },
        });
      }
      await tx.userOrganization.delete({ where: { id: row.id } });
    });
    return { deleted: true as const, memberId: row.id };
  }

  private async assertUserOrgIdsInOrganization(
    organizationId: string,
    uoIds: string[],
  ) {
    if (uoIds.length === 0) return;
    const distinct = [...new Set(uoIds)];
    const n = await this.prisma.userOrganization.count({
      where: {
        id: { in: distinct },
        organizationId,
        status: 'ACTIVE',
      },
    });
    if (n !== distinct.length) {
      throw new BadRequestException('部分成员无效、已归档或不属于该组织');
    }
  }

  async listOrganizationRoles(organizationId: string) {
    const rows = await this.prisma.role.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        members: r.members.map((m) => ({
          memberId: m.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
        })),
      })),
    };
  }

  async createOrganizationRole(
    organizationId: string,
    actorSystemRole: string,
    dto: CreateOrganizationRoleDto,
  ) {
    if (!canInvite.includes(actorSystemRole as SystemRole)) {
      throw new ForbiddenException('无权限管理自定义角色');
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('请填写角色名称');
    }
    const uoIds = dto.memberUserOrganizationIds ?? [];
    const distinct = [...new Set(uoIds)];
    await this.assertUserOrgIdsInOrganization(organizationId, distinct);
    try {
      return await this.prisma.role.create({
        data: {
          organizationId,
          name,
          members: distinct.length
            ? { connect: distinct.map((id) => ({ id })) }
            : undefined,
        },
        include: {
          members: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }).then((r) => this.serializeCustomRole(r));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该角色名已存在');
      }
      throw e;
    }
  }

  private serializeCustomRole(r: {
    id: string
    name: string
    members: {
      id: string
      user: { firstName: string; lastName: string; email: string }
    }[]
  }) {
    return {
      id: r.id,
      name: r.name,
      members: r.members.map((m) => ({
        memberId: m.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
      })),
    };
  }

  async updateOrganizationRole(
    organizationId: string,
    roleId: string,
    actorSystemRole: string,
    dto: UpdateOrganizationRoleDto,
  ) {
    if (!canInvite.includes(actorSystemRole as SystemRole)) {
      throw new ForbiddenException('无权限管理自定义角色');
    }
    const existing = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('角色不存在');
    }
    const uoIds =
      dto.memberUserOrganizationIds !== undefined
        ? [...new Set(dto.memberUserOrganizationIds)]
        : null;
    if (uoIds) {
      await this.assertUserOrgIdsInOrganization(organizationId, uoIds);
    }
    const name = dto.name !== undefined ? dto.name.trim() : undefined;
    if (name === '') {
      throw new BadRequestException('请填写角色名称');
    }
    try {
      const r = await this.prisma.role.update({
        where: { id: roleId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(uoIds !== null
            ? { members: { set: uoIds.map((id) => ({ id })) } }
            : {}),
        },
        include: {
          members: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
      return this.serializeCustomRole(r);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该角色名已存在');
      }
      throw e;
    }
  }

  async deleteOrganizationRole(
    organizationId: string,
    actorSystemRole: string,
    roleId: string,
  ) {
    if (!canInvite.includes(actorSystemRole as SystemRole)) {
      throw new ForbiddenException('无权限管理自定义角色');
    }
    const n = await this.prisma.role.deleteMany({
      where: { id: roleId, organizationId },
    });
    if (n.count === 0) {
      throw new NotFoundException('角色不存在');
    }
    return { deleted: true as const, roleId };
  }
}

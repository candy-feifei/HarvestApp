import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSkipTake,
  toPaginatedResult,
} from '../../common/utils/pagination.util';
import { AuthService } from '../auth/auth.service';
import { InviteMemberDto } from './dto/invite-member.dto';

const canInvite: SystemRole[] = ['ADMINISTRATOR', 'MANAGER'];

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
}

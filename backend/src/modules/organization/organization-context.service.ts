import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ActiveMembership = {
  organizationId: string;
  memberId: string;
  systemRole: string;
  organization: {
    id: string;
    name: string;
    defaultCurrency: string;
  };
};

type MemberRow = {
  id: string;
  organizationId: string;
  systemRole: string;
  organization: {
    id: string;
    name: string;
    defaultCurrency: string;
  };
};

@Injectable()
export class OrganizationContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析当前用户可用的组织：优先 `X-Organization-Id`（需校验成员身份），
   * 否则取该用户加入的第一个有效成员关系。
   * 若用户尚无任何组织（例如仅完成注册未跑 seed），将自动创建默认工作区并作为管理员加入。
   */
  async getActiveMembership(
    userId: string,
    preferredOrgId: string | undefined,
  ): Promise<ActiveMembership> {
    if (preferredOrgId) {
      const row = await this.prisma.userOrganization.findFirst({
        where: {
          userId,
          organizationId: preferredOrgId,
          status: 'ACTIVE',
        },
        include: {
          organization: {
            select: { id: true, name: true, defaultCurrency: true },
          },
        },
      });
      if (!row) {
        throw new ForbiddenException('您不属于该组织或该成员已停用');
      }
      return this.toActive(row);
    }

    const row = await this.prisma.userOrganization.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
      include: {
        organization: {
          select: { id: true, name: true, defaultCurrency: true },
        },
      },
    });
    if (row) {
      return this.toActive(row);
    }
    return this.ensureDefaultMembership(userId);
  }

  private toActive(row: MemberRow): ActiveMembership {
    return {
      organizationId: row.organizationId,
      memberId: row.id,
      systemRole: row.systemRole,
      organization: row.organization,
    };
  }

  /** 为首次使用业务功能的用户准备默认组织（自助注册、未跑 seed 等场景） */
  private async ensureDefaultMembership(
    userId: string,
  ): Promise<ActiveMembership> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userOrganization.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { id: 'asc' },
        include: {
          organization: {
            select: { id: true, name: true, defaultCurrency: true },
          },
        },
      });
      if (existing) {
        return this.toActive(existing);
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { firstName: true, email: true },
      });
      if (!user) {
        throw new ForbiddenException(
          '无法同步工作区：当前令牌对应的用户已不存在于系统中，请重新登录后再试。',
        );
      }

      const raw = user.firstName?.trim() || user.email.split('@')[0] || 'My';
      const label = raw.slice(0, 120);
      const org = await tx.organization.create({
        data: {
          name: `${label} 的工作区`,
          defaultCurrency: 'USD',
        },
      });
      const member = await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
          systemRole: 'ADMINISTRATOR',
          status: 'ACTIVE',
        },
        include: {
          organization: {
            select: { id: true, name: true, defaultCurrency: true },
          },
        },
      });
      return this.toActive(member);
    });
  }
}

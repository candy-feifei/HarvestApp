import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthService } from '../auth/auth.service'
import { OrganizationService } from './organization.service'

describe('OrganizationService', () => {
  it('listMembers: 映射成员与最新费率', async () => {
    const userOrganization = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'uo-1',
          userId: 'u-1',
          systemRole: 'MEMBER',
          weeklyCapacity: 40,
          employeeId: 'E1',
          employmentType: 'FULL_TIME',
          jobLabel: 'Dev',
          user: {
            id: 'u-1',
            email: 'x@y.com',
            firstName: 'A',
            lastName: 'B',
            invitationStatus: 'ACTIVE',
          },
          rateHistories: [
            {
              billableRate: new Prisma.Decimal(100),
              costRate: new Prisma.Decimal(50),
            },
          ],
        },
      ]),
    }
    const prisma = { userOrganization } as unknown as PrismaService
    const auth = {} as AuthService

    const service = new OrganizationService(prisma, auth)
    const out = await service.listMembers('org-1')

    expect(userOrganization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', status: 'ACTIVE' },
      }),
    )
    expect(out.items).toHaveLength(1)
    expect(out.items[0]).toMatchObject({
      memberId: 'uo-1',
      userId: 'u-1',
      email: 'x@y.com',
      defaultBillableRatePerHour: 100,
      costRatePerHour: 50,
    })
  })
})

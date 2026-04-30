import { BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import type { ActiveMembership } from '../organization/organization-context.service'
import { TimeEntriesService } from './time-entries.service'

const membership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
  organization: { id: 'org-1', name: 'O', defaultCurrency: 'USD' },
}

const user: CurrentUserPayload = { userId: 'u-1', email: 't@u.com' }

describe('TimeEntriesService', () => {
  it('list: 同时指定 week 与 month 抛 BadRequestException', async () => {
    const prisma = {} as PrismaService
    const service = new TimeEntriesService(prisma)

    await expect(
      service.list(membership, user, {
        week: '2026-04-06',
        month: '2026-04',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('listAssignableRows: 普通成员仅查本人被分配项目的 projectTask', async () => {
    const projectTask = { findMany: jest.fn().mockResolvedValue([]) }
    const prisma = { projectTask } as unknown as PrismaService
    const service = new TimeEntriesService(prisma)

    await service.listAssignableRows(membership, user)

    expect(projectTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: expect.objectContaining({
            organizationId: 'org-1',
            assignments: { some: { userId: 'u-1' } },
          }),
        }),
      }),
    )
  })
})

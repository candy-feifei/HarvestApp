import { NotFoundException } from '@nestjs/common'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { OrganizationContextService } from '../organization/organization-context.service'
import { ProjectsService } from './projects.service'

const actor: CurrentUserPayload = { userId: 'u-1', email: 'a@b.com' }

const activeMembership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
  organization: { id: 'org-1', name: 'O', defaultCurrency: 'USD' },
}

describe('ProjectsService', () => {
  it('getById: 项目不存在时抛 NotFoundException', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn(),
      expense: { aggregate: jest.fn() },
    } as unknown as PrismaService

    const orgContext = {
      getActiveMembership: jest.fn().mockResolvedValue(activeMembership),
    } as unknown as OrganizationContextService

    const service = new ProjectsService(prisma, orgContext)

    await expect(service.getById('missing', actor, undefined)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(orgContext.getActiveMembership).toHaveBeenCalledWith('u-1', undefined)
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'missing', organizationId: 'org-1' },
      }),
    )
  })
})

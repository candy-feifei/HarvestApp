import { ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { ApprovalsService } from './approvals.service'

const memberRole: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
  organization: { id: 'org-1', name: 'O', defaultCurrency: 'USD' },
}

describe('ApprovalsService', () => {
  it('requireApprover: 普通成员抛 ForbiddenException', () => {
    const service = new ApprovalsService({} as PrismaService)
    expect(() => service.requireApprover(memberRole)).toThrow(ForbiddenException)
  })

  it('requireApprover: 管理员不抛错', () => {
    const service = new ApprovalsService({} as PrismaService)
    const admin = { ...memberRole, systemRole: 'ADMINISTRATOR' as const }
    expect(() => service.requireApprover(admin)).not.toThrow()
  })
})

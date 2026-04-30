import { BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { ReportsService } from './reports.service'

const membership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
  organization: { id: 'org-1', name: 'O', defaultCurrency: 'USD' },
}

describe('ReportsService', () => {
  it('getTimeReport: 开始日晚于结束日抛 BadRequestException', async () => {
    const prisma = {} as PrismaService
    const service = new ReportsService(prisma)

    await expect(
      service.getTimeReport(membership, {
        fromYmd: '2026-04-10',
        toYmd: '2026-04-01',
        groupBy: 'projects',
      } as Parameters<ReportsService['getTimeReport']>[1]),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('getReportFilters: 聚合四类筛选项', async () => {
    const client = { findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'C' }]) }
    const userOrganization = {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.com' },
        },
      ]),
    }
    const project = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'p1',
          name: 'P',
          billingMethod: 'TM',
          isArchived: false,
          clientId: 'c1',
          client: { name: 'C' },
          assignments: [{ userId: 'u1', isManager: true }],
        },
      ]),
    }
    const task = { findMany: jest.fn().mockResolvedValue([{ id: 't1', name: 'T' }]) }
    const prisma = { client, userOrganization, project, task } as unknown as PrismaService

    const service = new ReportsService(prisma)
    const out = await service.getReportFilters(membership)

    expect(out.currency).toBe('USD')
    expect(out.clients).toEqual([{ id: 'c1', name: 'C' }])
    expect(out.tasks).toEqual([{ id: 't1', name: 'T' }])
    expect(out.team[0]).toMatchObject({ userId: 'u1', email: 'a@b.com' })
    expect(out.projects[0]).toMatchObject({
      id: 'p1',
      clientName: 'C',
      hasManager: true,
    })
  })
})

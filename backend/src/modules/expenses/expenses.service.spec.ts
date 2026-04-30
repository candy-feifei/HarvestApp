import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { ExpensesService } from './expenses.service'

const membership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
  organization: { id: 'org-1', name: 'Test Org', defaultCurrency: 'EUR' },
}

function makePrismaMock() {
  const project = { findMany: jest.fn() }
  const expenseCategory = { findMany: jest.fn() }
  const prisma = { project, expenseCategory } as unknown as PrismaService
  return { prisma, project, expenseCategory }
}

describe('ExpensesService', () => {
  it('getFormOptions: 合并项目、分类与默认货币', async () => {
    const { prisma, project, expenseCategory } = makePrismaMock()
    project.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Proj',
        client: { name: 'Client A' },
      },
    ])
    expenseCategory.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Travel',
        unitName: 'trip',
        unitPrice: new Prisma.Decimal('12.5'),
        isArchived: false,
      },
    ])

    const service = new ExpensesService(prisma)
    const out = await service.getFormOptions(membership)

    expect(project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', isArchived: false },
      }),
    )
    expect(out.defaultCurrency).toBe('EUR')
    expect(out.projects).toEqual([{ id: 'p1', name: 'Proj', clientName: 'Client A' }])
    expect(out.categories[0]).toMatchObject({
      id: 'c1',
      name: 'Travel',
      unitName: 'trip',
      unitPrice: '12.5',
    })
  })
})

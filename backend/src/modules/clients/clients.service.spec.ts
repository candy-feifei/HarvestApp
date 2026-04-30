import { BadRequestException } from '@nestjs/common'
import { InvoiceDueMode } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { ClientsService } from './clients.service'

const membership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
  organization: { id: 'org-1', name: 'Test Org', defaultCurrency: 'USD' },
}

function makePrismaMock() {
  const client = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  const project = { count: jest.fn() }
  const clientContact = { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }
  const prisma = { client, project, clientContact } as unknown as PrismaService
  return { prisma, client, project, clientContact }
}

describe('ClientsService', () => {
  it('list: 无搜索词时 where 含 organizationId 与 isArchived: false', async () => {
    const { prisma, client } = makePrismaMock()
    client.findMany.mockResolvedValue([])

    const service = new ClientsService(prisma)
    await service.list(membership, undefined)

    expect(client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          isArchived: false,
        }),
        orderBy: { name: 'asc' },
      }),
    )
  })

  it('create: NET_DAYS 但未填 invoiceNetDays 时抛 BadRequestException', async () => {
    const { prisma, client } = makePrismaMock()
    const service = new ClientsService(prisma)

    await expect(
      service.create(membership, {
        name: 'Acme',
        invoiceDueMode: InvoiceDueMode.NET_DAYS,
        invoiceNetDays: undefined,
      } as Parameters<ClientsService['create']>[1]),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(client.create).not.toHaveBeenCalled()
  })

  it('create: 非 NET_DAYS 却填写 invoiceNetDays 时抛 BadRequestException', async () => {
    const { prisma, client } = makePrismaMock()
    const service = new ClientsService(prisma)

    await expect(
      service.create(membership, {
        name: 'Acme',
        invoiceDueMode: InvoiceDueMode.UPON_RECEIPT,
        invoiceNetDays: 30,
      } as Parameters<ClientsService['create']>[1]),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(client.create).not.toHaveBeenCalled()
  })
})

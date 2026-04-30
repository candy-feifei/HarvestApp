import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { CreateClientDto } from './dto/create-client.dto'
import { CreateClientContactDto } from './dto/create-client-contact.dto'

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n)
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(membership: ActiveMembership, q?: string) {
    const orgId = membership.organizationId
    const trimmed = q?.trim() ?? ''
    const where: Prisma.ClientWhereInput = {
      organizationId: orgId,
      isArchived: false,
    }
    if (trimmed) {
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        {
          contacts: {
            some: {
              OR: [
                { firstName: { contains: trimmed, mode: 'insensitive' } },
                { lastName: { contains: trimmed, mode: 'insensitive' } },
                { email: { contains: trimmed, mode: 'insensitive' } },
                { title: { contains: trimmed, mode: 'insensitive' } },
                { phone: { contains: trimmed, mode: 'insensitive' } },
              ],
            },
          },
        },
      ]
    }
    const rows = await this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        _count: { select: { contacts: true } },
        contacts: {
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            title: true,
          },
        },
      },
    })
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        contactCount: r._count.contacts,
        contacts: r.contacts,
      })),
    }
  }

  async getContact(
    membership: ActiveMembership,
    clientId: string,
    contactId: string,
  ) {
    const contact = await this.prisma.clientContact.findFirst({
      where: {
        id: contactId,
        clientId,
        client: {
          organizationId: membership.organizationId,
          isArchived: false,
        },
      },
    })
    if (!contact) {
      throw new NotFoundException('未找到该联系人或无权访问')
    }
    return {
      id: contact.id,
      clientId: contact.clientId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      title: contact.title,
      officeNumber: (contact as { officeNumber?: string | null }).officeNumber ?? null,
      faxNumber: (contact as { faxNumber?: string | null }).faxNumber ?? null,
      mobileNumber: contact.phone,
    }
  }

  async updateContact(
    membership: ActiveMembership,
    clientId: string,
    contactId: string,
    dto: CreateClientContactDto,
  ) {
    const existing = await this.prisma.clientContact.findFirst({
      where: {
        id: contactId,
        clientId,
        client: {
          organizationId: membership.organizationId,
        },
      },
    })
    if (!existing) {
      throw new NotFoundException('未找到该联系人或无权访问')
    }
    const c = await this.prisma.clientContact.update({
      where: { id: contactId },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.trim().toLowerCase(),
        title: dto.title?.trim() || null,
        phone: dto.mobileNumber?.trim() || null,
        officeNumber: dto.officeNumber?.trim() || null,
        faxNumber: dto.faxNumber?.trim() || null,
      } as any,
    })
    return { id: c.id, clientId: c.clientId }
  }

  async getOne(membership: ActiveMembership, id: string) {
    const row = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        isArchived: false,
      },
      include: {
        projects: {
          where: { isArchived: false },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { projects: true } },
      },
    })
    if (!row) {
      throw new NotFoundException('未找到该客户或无权访问')
    }
    const { projects, _count, ...client } = row
    return {
      ...this.withResolvedCurrency(
        client,
        membership.organization.defaultCurrency,
      ),
      activeProjects: projects,
      projectCount: _count.projects,
    }
  }

  async createContact(
    membership: ActiveMembership,
    clientId: string,
    dto: CreateClientContactDto,
  ) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: membership.organizationId,
        isArchived: false,
      },
      select: { id: true, name: true },
    })
    if (!client) {
      throw new NotFoundException('未找到该客户或无权访问')
    }
    const contact = await this.prisma.clientContact.create({
      data: {
        clientId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.trim().toLowerCase(),
        title: dto.title?.trim() || null,
        phone: dto.mobileNumber?.trim() || null,
        officeNumber: dto.officeNumber?.trim() || null,
        faxNumber: dto.faxNumber?.trim() || null,
      },
    })
    return { ...contact, clientName: client.name }
  }

  async update(membership: ActiveMembership, id: string, dto: CreateClientDto) {
    const existing = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        isArchived: false,
      },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundException('未找到该客户或无权访问')
    }
    if (dto.invoiceDueMode === 'NET_DAYS') {
      if (dto.invoiceNetDays == null) {
        throw new BadRequestException('选择「发票后 N 天」时必须填写天数')
      }
    } else if (dto.invoiceNetDays != null) {
      throw new BadRequestException('仅「发票后 N 天」模式可填写 invoiceNetDays')
    }
    if (dto.secondaryTaxEnabled && dto.secondaryTaxRate == null) {
      throw new BadRequestException('启用第二税率时必须填写第二税率')
    }
    const secondaryRate =
      dto.secondaryTaxEnabled && dto.secondaryTaxRate != null
        ? toDecimal(dto.secondaryTaxRate)
        : null
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        currency: dto.currency ?? null,
        taxRate: dto.taxRate != null ? toDecimal(dto.taxRate) : null,
        secondaryTaxRate: secondaryRate,
        discountRate: dto.discountRate != null ? toDecimal(dto.discountRate) : null,
        invoiceDueMode: dto.invoiceDueMode,
        invoiceNetDays:
          dto.invoiceDueMode === 'NET_DAYS' ? dto.invoiceNetDays! : null,
      },
    })
    return this.withResolvedCurrency(
      client,
      membership.organization.defaultCurrency,
    )
  }

  async archive(membership: ActiveMembership, id: string) {
    const row = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        isArchived: false,
      },
    })
    if (!row) {
      throw new NotFoundException('未找到该客户或无权访问')
    }
    const activeCount = await this.prisma.project.count({
      where: { clientId: id, isArchived: false },
    })
    if (activeCount > 0) {
      throw new BadRequestException(
        `You cannot archive “${row.name}” because it has active projects.`,
      )
    }
    await this.prisma.client.update({
      where: { id },
      data: { isArchived: true },
    })
    return { archived: true as const }
  }

  async remove(membership: ActiveMembership, id: string) {
    const row = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        isArchived: false,
      },
    })
    if (!row) {
      throw new NotFoundException('未找到该客户或无权访问')
    }
    const projectCount = await this.prisma.project.count({
      where: { clientId: id },
    })
    if (projectCount > 0) {
      throw new BadRequestException(
        'Delete all projects for this client (or archive them) before deleting the client.',
      )
    }
    await this.prisma.client.delete({ where: { id } })
    return { deleted: true as const }
  }

  async create(membership: ActiveMembership, dto: CreateClientDto) {
    if (dto.invoiceDueMode === 'NET_DAYS') {
      if (dto.invoiceNetDays == null) {
        throw new BadRequestException('选择「发票后 N 天」时必须填写天数')
      }
    } else if (dto.invoiceNetDays != null) {
      throw new BadRequestException('仅「发票后 N 天」模式可填写 invoiceNetDays')
    }

    if (dto.secondaryTaxEnabled && dto.secondaryTaxRate == null) {
      throw new BadRequestException('启用第二税率时必须填写第二税率')
    }

    const secondaryRate =
      dto.secondaryTaxEnabled && dto.secondaryTaxRate != null
        ? toDecimal(dto.secondaryTaxRate)
        : null

    const client = await this.prisma.client.create({
      data: {
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        organizationId: membership.organizationId,
        currency: dto.currency ?? null,
        taxRate: dto.taxRate != null ? toDecimal(dto.taxRate) : null,
        secondaryTaxRate: secondaryRate,
        discountRate: dto.discountRate != null ? toDecimal(dto.discountRate) : null,
        invoiceDueMode: dto.invoiceDueMode,
        invoiceNetDays: dto.invoiceDueMode === 'NET_DAYS' ? dto.invoiceNetDays! : null,
      },
    })

    return this.withResolvedCurrency(client, membership.organization.defaultCurrency)
  }

  private withResolvedCurrency(
    client: {
      id: string
      name: string
      address: string | null
      organizationId: string
      currency: string | null
      taxRate: Prisma.Decimal | null
      secondaryTaxRate: Prisma.Decimal | null
      discountRate: Prisma.Decimal | null
      invoiceDueMode: import('@prisma/client').InvoiceDueMode
      invoiceNetDays: number | null
      isArchived: boolean
      createdAt: Date
      updatedAt: Date
    },
    orgDefaultCurrency: string,
  ) {
    return {
      ...client,
      taxRate: client.taxRate?.toString() ?? null,
      secondaryTaxRate: client.secondaryTaxRate?.toString() ?? null,
      discountRate: client.discountRate?.toString() ?? null,
      resolvedCurrency: client.currency ?? orgDefaultCurrency,
    }
  }
}

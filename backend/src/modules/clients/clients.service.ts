import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { CreateClientDto } from './dto/create-client.dto'

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
      },
    })
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        contactCount: r._count.contacts,
      })),
    }
  }

  async getOne(membership: ActiveMembership, id: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        isArchived: false,
      },
    })
    if (!client) {
      throw new NotFoundException('未找到该客户或无权访问')
    }
    return this.withResolvedCurrency(
      client,
      membership.organization.defaultCurrency,
    )
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

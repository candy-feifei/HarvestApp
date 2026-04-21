import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSkipTake,
  toPaginatedResult,
} from '../../common/utils/pagination.util';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsersPaginated(page: number, pageSize: number) {
    const { skip, take } = getSkipTake(page, pageSize);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return toPaginatedResult(data, page, pageSize, total);
  }
}

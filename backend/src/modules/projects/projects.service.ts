import { Injectable } from '@nestjs/common';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSkipTake,
  toPaginatedResult,
} from '../../common/utils/pagination.util';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjectsPaginated(
    page: number,
    pageSize: number,
    _actor: CurrentUserPayload,
  ) {
    void _actor;
    const { skip, take } = getSkipTake(page, pageSize);
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: { owner: true },
      }),
      this.prisma.project.count(),
    ]);
    return toPaginatedResult(data, page, pageSize, total);
  }
}

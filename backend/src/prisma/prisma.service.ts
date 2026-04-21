import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 不在 onModuleInit 中强制 $connect，避免本机未起 PostgreSQL 时整个 API 无法启动。
 * 首次查询时 Prisma 会自动建连；关进程时在 onModuleDestroy 中断开。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

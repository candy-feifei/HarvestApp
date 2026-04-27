import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { logPrismaQueryEvent } from './prisma-sql-log.util';

const prismaSqlLogger = new Logger('PrismaSQL');

/**
 * 设置 `PRISMA_LOG_QUERIES=1` 后，会输出**展开参数后的 SQL**（将 `$1` 等替换为可读字面量）及耗时。
 * 默认的 Prisma 简短 query 行会关闭，避免与展开版重复。
 * 生产环境勿长期开启。
 */
function prismaLogOptions():
  | (Prisma.LogLevel | Prisma.LogDefinition)[]
  | Prisma.LogLevel[] {
  if (process.env.PRISMA_LOG_QUERIES === '1' || process.env.PRISMA_LOG_QUERIES === 'true') {
    return [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ]
  }
  return ['error', 'warn']
}

/**
 * 不在 onModuleInit 中强制 $connect，避免本机未起 PostgreSQL 时整个 API 无法启动。
 * 首次查询时 Prisma 会自动建连；关进程时在 onModuleDestroy 中断开。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ log: prismaLogOptions() })
    if (process.env.PRISMA_LOG_QUERIES === '1' || process.env.PRISMA_LOG_QUERIES === 'true') {
      const self = this as unknown as {
        $on: (ev: 'query', cb: (e: Prisma.QueryEvent) => void) => void
      }
      self.$on('query', (e: Prisma.QueryEvent) => {
        logPrismaQueryEvent(e, (msg) => prismaSqlLogger.log(msg))
      })
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { PrismaService } from '../../prisma/prisma.service'
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('getStatus: 数据库查询成功时 database 为 true', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService

    const service = new HealthService(prisma)
    const out = await service.getStatus()

    expect(out.status).toBe('ok')
    expect(out.database).toBe(true)
    expect(typeof out.uptime).toBe('number')
    expect(prisma.$queryRaw).toHaveBeenCalled()
  })

  it('getStatus: 数据库异常时 database 为 false', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PrismaService

    const service = new HealthService(prisma)
    const out = await service.getStatus()

    expect(out.database).toBe(false)
  })
})

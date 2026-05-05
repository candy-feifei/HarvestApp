import { Test } from '@nestjs/testing'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

describe('HealthController', () => {
  it('GET / 委托 HealthService.getStatus', async () => {
    const getStatus = jest.fn().mockResolvedValue({
      status: 'ok',
      database: true,
      uptime: 1,
    })
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { getStatus } }],
    }).compile()

    const controller = moduleRef.get(HealthController)
    const out = await controller.getHealth()

    expect(getStatus).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ status: 'ok', database: true, uptime: 1 })
  })
})

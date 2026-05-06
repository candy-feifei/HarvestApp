import type { ConfigService } from '@nestjs/config'
import { parseDurationToSeconds, resolveJwtSecret } from './jwt.config'

describe('jwt.config', () => {
  describe('resolveJwtSecret', () => {
    it('读取环境配置中的 JWT_SECRET', () => {
      const config = {
        get: jest.fn((key: string) =>
          key === 'JWT_SECRET' ? 'prod-secret' : undefined,
        ),
      } as unknown as ConfigService
      expect(resolveJwtSecret(config)).toBe('prod-secret')
    })

    it('未配置时使用开发缺省占位（须在生产环境覆盖）', () => {
      const config = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService
      expect(resolveJwtSecret(config)).toBe('dev-insecure-change-me')
    })
  })

  describe('parseDurationToSeconds', () => {
    it('解析 s / m / h / d 单位', () => {
      expect(parseDurationToSeconds('30s')).toBe(30)
      expect(parseDurationToSeconds('5m')).toBe(300)
      expect(parseDurationToSeconds('2h')).toBe(7200)
      expect(parseDurationToSeconds('7d')).toBe(7 * 86400)
    })

    it('非法格式回退为 7 天（秒）', () => {
      expect(parseDurationToSeconds('')).toBe(7 * 24 * 3600)
      expect(parseDurationToSeconds('not-a-duration')).toBe(7 * 24 * 3600)
    })

    it('忽略首尾空白', () => {
      expect(parseDurationToSeconds('  10m  ')).toBe(600)
    })
  })
})

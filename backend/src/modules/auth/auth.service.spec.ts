import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from './auth.service'
import { MailService } from './mail.service'

function makeAuthDeps(overrides: {
  configGet?: (key: string) => string | undefined
  prisma?: Partial<Record<string, unknown>>
}) {
  const config = {
    get: jest.fn((key: string) => overrides.configGet?.(key)),
  } as unknown as ConfigService

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
  } as unknown as JwtService

  const mail = {} as MailService

  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  }
  const loginAttempt = { create: jest.fn().mockResolvedValue({}) }
  const prisma = {
    user,
    loginAttempt,
    passwordResetToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    ...(overrides.prisma ?? {}),
  } as unknown as PrismaService

  return { config, jwtService, mail, prisma, user, loginAttempt }
}

describe('AuthService', () => {
  it('register: 关闭自助注册时抛 ForbiddenException', async () => {
    const { config, jwtService, mail, prisma } = makeAuthDeps({
      configGet: (key) => (key === 'AUTH_ALLOW_REGISTRATION' ? 'false' : undefined),
    })
    const service = new AuthService(prisma, jwtService, config, mail)

    await expect(
      service.register({
        email: 'new@example.com',
        password: 'longenough',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('login: 用户不存在时抛 UnauthorizedException 并记录失败尝试', async () => {
    const { config, jwtService, mail, prisma, user, loginAttempt } = makeAuthDeps({
      configGet: () => undefined,
    })
    user.findUnique.mockResolvedValue(null)

    const service = new AuthService(prisma, jwtService, config, mail)

    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' }, '127.0.0.1', undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(loginAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nobody@example.com',
          success: false,
          failureReason: 'user_not_found',
        }),
      }),
    )
  })
})

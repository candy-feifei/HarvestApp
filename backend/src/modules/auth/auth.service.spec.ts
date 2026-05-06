jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-by-mock'),
}))

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
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

  it('register: 邮箱已存在时抛 ConflictException', async () => {
    const { config, jwtService, mail, prisma, user } = makeAuthDeps({
      configGet: () => undefined,
    })
    user.findUnique.mockResolvedValue({ id: 'u1', email: 'e@e.com' })
    const service = new AuthService(prisma, jwtService, config, mail)

    await expect(
      service.register({ email: 'E@E.COM', password: 'longenough' }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(user.create).not.toHaveBeenCalled()
  })

  it('register: 允许注册时创建用户并签发 token', async () => {
    const { config, jwtService, mail, prisma, user } = makeAuthDeps({
      configGet: () => undefined,
    })
    user.findUnique.mockResolvedValue(null)
    user.create.mockResolvedValue({ id: 'new-id', email: 'new@example.com' })
    const service = new AuthService(prisma, jwtService, config, mail)

    const out = await service.register({
      email: 'new@example.com',
      password: 'longenough',
      name: '  Neo  ',
    })

    expect(bcrypt.hash).toHaveBeenCalled()
    expect(user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          firstName: 'Neo',
        }),
      }),
    )
    expect(out).toEqual(
      expect.objectContaining({
        access_token: 'jwt-token',
        token_type: 'Bearer',
      }),
    )
  })

  it('changePassword: 新旧密码相同抛 BadRequestException', async () => {
    const { config, jwtService, mail, prisma } = makeAuthDeps({})
    const service = new AuthService(prisma, jwtService, config, mail)
    await expect(
      service.changePassword('uid', {
        currentPassword: 'a',
        newPassword: 'a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('changePassword: 用户不存在抛 NotFoundException', async () => {
    const { config, jwtService, mail, prisma, user } = makeAuthDeps({})
    user.findUnique.mockResolvedValue(null)
    const service = new AuthService(prisma, jwtService, config, mail)
    await expect(
      service.changePassword('uid', {
        currentPassword: 'old',
        newPassword: 'new1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('changePassword: 未设置本地密码抛 BadRequestException', async () => {
    const { config, jwtService, mail, prisma, user } = makeAuthDeps({})
    user.findUnique.mockResolvedValue({
      id: 'u1',
      passwordHash: null,
    })
    const service = new AuthService(prisma, jwtService, config, mail)
    await expect(
      service.changePassword('u1', {
        currentPassword: 'old',
        newPassword: 'new1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('changePassword: 当前密码错误抛 UnauthorizedException', async () => {
    const { config, jwtService, mail, prisma, user } = makeAuthDeps({})
    user.findUnique.mockResolvedValue({
      id: 'u1',
      passwordHash: 'hash',
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const service = new AuthService(prisma, jwtService, config, mail)
    await expect(
      service.changePassword('u1', {
        currentPassword: 'wrong',
        newPassword: 'new1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('requestPasswordReset: 用户无本地密码时仍返回 sent（防枚举）', async () => {
    const { config, jwtService, mail, prisma, user } = makeAuthDeps({})
    user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null })
    const service = new AuthService(prisma, jwtService, config, mail)
    const out = await service.requestPasswordReset(
      { email: 'a@b.com' },
      '127.0.0.1',
    )
    expect(out).toEqual({ sent: true })
  })
})

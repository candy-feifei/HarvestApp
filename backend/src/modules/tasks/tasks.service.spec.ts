/**
 * Tasks 模块单测约定（Jest + Nest）：
 * - 位置：与本模块源文件同目录，文件名 `*.spec.ts`（与根 package.json 中 `testRegex` 一致）。
 * - Mock：对 `PrismaService` 做浅层 mock（`task` / `project` / `projectTask` / `$transaction` 等仅 stub 本用例会调用的方法），
 *   不连真实数据库；需要覆盖 HTTP 与 Guard 时再用 `test/jest-e2e.json` 做 e2e。
 */
import { BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { TasksService } from './tasks.service'

const membership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  organization: { id: 'org-1', name: 'Test Org', defaultCurrency: 'USD' },
}

function makePrismaMock() {
  const task = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  }
  const project = { findMany: jest.fn(), update: jest.fn() }
  const projectTask = { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() }
  const base = {
    task,
    project,
    projectTask,
    $transaction: jest.fn((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg)
      }
      if (typeof arg === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return (arg as (tx: typeof base) => Promise<unknown>)(base)
      }
      return Promise.resolve(undefined)
    }),
  } as unknown as PrismaService
  return { prisma: base, task, project, projectTask }
}

describe('TasksService', () => {
  it('list: 按 isCommon 分为 common / other，并传 organizationId 条件', async () => {
    const { prisma, task } = makePrismaMock()
    const rowCommon = {
      id: 't1',
      name: 'A',
      isCommon: true,
      isBillable: true,
      defaultHourlyRate: new Prisma.Decimal(100),
    }
    const rowOther = {
      id: 't2',
      name: 'B',
      isCommon: false,
      isBillable: true,
      defaultHourlyRate: null,
    }
    task.findMany.mockResolvedValue([rowOther, rowCommon])

    const service = new TasksService(prisma)
    const out = await service.list(membership, undefined)

    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          isArchived: false,
        }),
        orderBy: { name: 'asc' },
      }),
    )
    expect(out.common).toEqual([
      {
        id: 't1',
        name: 'A',
        isCommon: true,
        isBillable: true,
        defaultHourlyRate: '100',
      },
    ])
    expect(out.other).toEqual([
      {
        id: 't2',
        name: 'B',
        isCommon: false,
        isBillable: true,
        defaultHourlyRate: null,
      },
    ])
  })

  it('create: 名称为空时抛 BadRequestException，且不调用 create', async () => {
    const { prisma, task } = makePrismaMock()
    const service = new TasksService(prisma)
    await expect(
      service.create(membership, {
        name: '   ',
        isCommon: false,
        isBillable: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(task.create).not.toHaveBeenCalled()
  })

  it('buildCsv: 转义 name 中的双引号', () => {
    const { prisma } = makePrismaMock()
    const service = new TasksService(prisma)
    const body = service.buildCsv([
      {
        name: 'foo"bar',
        isCommon: true,
        isBillable: false,
        defaultHourlyRate: new Prisma.Decimal(10),
      },
    ])
    expect(body).toContain('foo""bar')
  })
})

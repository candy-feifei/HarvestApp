/**
 * Tasks 模块单测约定（Jest + Nest）：
 * - 位置：与本模块源文件同目录，文件名 `*.spec.ts`（与根 package.json 中 `testRegex` 一致）。
 * - Mock：对 `PrismaService` 做浅层 mock（`task` / `project` / `projectTask` / `$transaction` 等仅 stub 本用例会调用的方法），
 *   不连真实数据库；需要覆盖 HTTP 与 Guard 时再用 `test/jest-e2e.json` 做 e2e。
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { TasksService } from './tasks.service'

const membership: ActiveMembership = {
  organizationId: 'org-1',
  memberId: 'm-1',
  systemRole: 'MEMBER',
  firstName: 'T',
  lastName: 'U',
  email: 't@u.com',
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

  it('list: 有搜索词时在 where.name 上使用 contains', async () => {
    const { prisma, task } = makePrismaMock()
    task.findMany.mockResolvedValue([])
    const service = new TasksService(prisma)
    await service.list(membership, '  alpha  ')
    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'alpha', mode: 'insensitive' },
        }),
      }),
    )
  })

  it('getOne: 不存在时抛 NotFoundException', async () => {
    const { prisma, task } = makePrismaMock()
    task.findFirst.mockResolvedValue(null)
    const service = new TasksService(prisma)
    await expect(service.getOne(membership, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('getOne: 已归档任务抛 NotFoundException', async () => {
    const { prisma, task } = makePrismaMock()
    task.findFirst.mockResolvedValue({
      id: 't1',
      name: 'X',
      isCommon: false,
      isBillable: true,
      defaultHourlyRate: null,
      isArchived: true,
    })
    const service = new TasksService(prisma)
    await expect(service.getOne(membership, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('update: 归档任务不可编辑', async () => {
    const { prisma, task } = makePrismaMock()
    task.findFirst.mockResolvedValue({
      id: 't1',
      name: 'X',
      isCommon: false,
      isBillable: true,
      defaultHourlyRate: null,
      isArchived: true,
    })
    const service = new TasksService(prisma)
    await expect(
      service.update(membership, 't1', { name: 'Y' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('bulkArchive: 空 id 列表返回 0', async () => {
    const { prisma, task } = makePrismaMock()
    const service = new TasksService(prisma)
    const out = await service.bulkArchive(membership, [])
    expect(out).toEqual({ updated: 0 })
    expect(task.updateMany).not.toHaveBeenCalled()
  })

  it('bulkArchive: 超过 200 条抛 BadRequestException', async () => {
    const { prisma } = makePrismaMock()
    const service = new TasksService(prisma)
    const ids = Array.from({ length: 201 }, (_, i) => String(i))
    await expect(service.bulkArchive(membership, ids)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('delete: 存在工时记录时不可删除', async () => {
    const { prisma, task, projectTask } = makePrismaMock()
    task.findFirst.mockResolvedValue({
      id: 't1',
      name: 'T',
      isCommon: false,
      isBillable: true,
      defaultHourlyRate: null,
      isArchived: false,
    })
    projectTask.findFirst.mockResolvedValue({
      timeEntries: [{ id: 'e1' }],
    })
    const service = new TasksService(prisma)
    await expect(service.delete(membership, 't1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('attachCommonTasksToNewProject: 已存在链接则跳过 create', async () => {
    const { prisma, task, projectTask } = makePrismaMock()
    task.findMany.mockResolvedValue([
      {
        id: 'ct1',
        isBillable: true,
        defaultHourlyRate: new Prisma.Decimal(50),
      },
    ])
    projectTask.findFirst.mockResolvedValue({ id: 'link' })
    const service = new TasksService(prisma)
    await service.attachCommonTasksToNewProject('org-1', 'proj-1')
    expect(projectTask.create).not.toHaveBeenCalled()
  })

  it('buildJson: 输出版本与条目字段', () => {
    const { prisma } = makePrismaMock()
    const service = new TasksService(prisma)
    const out = service.buildJson([
      {
        name: 'N',
        isCommon: true,
        isBillable: false,
        defaultHourlyRate: null,
      },
    ])
    expect(out).toEqual({
      version: 1,
      items: [
        {
          name: 'N',
          isCommon: true,
          isBillable: false,
          defaultHourlyRate: null,
        },
      ],
    })
  })

  it('getRowsForExport: 排序与可选 name 过滤', async () => {
    const { prisma, task } = makePrismaMock()
    task.findMany.mockResolvedValue([])
    const service = new TasksService(prisma)
    await service.getRowsForExport(membership, 'z')
    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'z', mode: 'insensitive' },
        }),
        orderBy: [{ isCommon: 'desc' }, { name: 'asc' }],
      }),
    )
  })
})

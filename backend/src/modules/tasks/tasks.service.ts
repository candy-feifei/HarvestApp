import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { ActiveMembership } from '../organization/organization-context.service'
import { CreateTaskDto } from './dto/create-task.dto'
import { UpdateTaskDto } from './dto/update-task.dto'

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n)
}

type TaskListItem = {
  id: string
  name: string
  isCommon: boolean
  isBillable: boolean
  defaultHourlyRate: string | null
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private mapTaskRow(t: {
    id: string
    name: string
    isCommon: boolean
    isBillable: boolean
    defaultHourlyRate: Prisma.Decimal | null
  }): TaskListItem {
    return {
      id: t.id,
      name: t.name,
      isCommon: t.isCommon,
      isBillable: t.isBillable,
      defaultHourlyRate: t.defaultHourlyRate?.toString() ?? null,
    }
  }

  private async getOrgTask(membership: ActiveMembership, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId: membership.organizationId },
    })
    if (!task) {
      throw new NotFoundException('未找到该任务或无权访问')
    }
    return task
  }

  /**
   * 创建新项目时调用：为项目追加当前组织的全部「通用、未归档」任务。
   * 供 Projects 模块在创建 `Project` 后注入。
   */
  async attachCommonTasksToNewProject(organizationId: string, projectId: string) {
    const commonTasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        isCommon: true,
        isArchived: false,
      },
    })
    for (const t of commonTasks) {
      const exists = await this.prisma.projectTask.findFirst({
        where: { projectId, taskId: t.id },
      })
      if (exists) {
        continue
      }
      await this.prisma.projectTask.create({
        data: {
          projectId,
          taskId: t.id,
          isBillable: t.isBillable,
          hourlyRate: t.defaultHourlyRate,
        },
      })
    }
  }

  async list(membership: ActiveMembership, q?: string) {
    const trimmed = q?.trim() ?? ''
    const where: Prisma.TaskWhereInput = {
      organizationId: membership.organizationId,
      isArchived: false,
    }
    if (trimmed) {
      where.name = { contains: trimmed, mode: 'insensitive' }
    }
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    const items = rows.map((r) => this.mapTaskRow(r))
    return {
      common: items.filter((r) => r.isCommon),
      other: items.filter((r) => !r.isCommon),
    }
  }

  async getOne(membership: ActiveMembership, id: string) {
    const task = await this.getOrgTask(membership, id)
    if (task.isArchived) {
      throw new NotFoundException('该任务已归档')
    }
    return this.mapTaskRow(task)
  }

  async create(membership: ActiveMembership, dto: CreateTaskDto) {
    const name = dto.name.trim()
    if (!name) {
      throw new BadRequestException('任务名称不能为空')
    }
    const task = await this.prisma.task.create({
      data: {
        name,
        isCommon: dto.isCommon,
        isBillable: dto.isBillable,
        defaultHourlyRate:
          dto.defaultHourlyRate != null ? toDecimal(dto.defaultHourlyRate) : null,
        organizationId: membership.organizationId,
      },
    })
    if (dto.addToAllExistingProjects) {
      await this.addTaskToAllActiveProjects(membership.organizationId, task)
    }
    return this.mapTaskRow(task)
  }

  private async addTaskToAllActiveProjects(
    orgId: string,
    task: { id: string; isBillable: boolean; defaultHourlyRate: Prisma.Decimal | null },
  ) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId: orgId, isArchived: false },
      select: { id: true },
    })
    for (const p of projects) {
      const exists = await this.prisma.projectTask.findFirst({
        where: { projectId: p.id, taskId: task.id },
      })
      if (exists) {
        continue
      }
      await this.prisma.projectTask.create({
        data: {
          projectId: p.id,
          taskId: task.id,
          isBillable: task.isBillable,
          hourlyRate: task.defaultHourlyRate,
        },
      })
    }
  }

  async update(membership: ActiveMembership, id: string, dto: UpdateTaskDto) {
    const current = await this.getOrgTask(membership, id)
    if (current.isArchived) {
      throw new BadRequestException('已归档任务不可编辑，请先恢复或新建')
    }
    if (dto.name != null) {
      const t = dto.name.trim()
      if (!t) {
        throw new BadRequestException('任务名称不能为空')
      }
    }
    const data: Prisma.TaskUpdateInput = {}
    if (dto.name != null) {
      data.name = dto.name.trim()
    }
    if (dto.isCommon != null) {
      data.isCommon = dto.isCommon
    }
    if (dto.isBillable != null) {
      data.isBillable = dto.isBillable
    }
    if (dto.defaultHourlyRate === null) {
      data.defaultHourlyRate = null
    } else if (dto.defaultHourlyRate != null) {
      data.defaultHourlyRate = toDecimal(dto.defaultHourlyRate)
    }
    let next = current
    if (Object.keys(data).length > 0) {
      next = await this.prisma.task.update({
        where: { id: current.id },
        data,
      })
    }
    if (dto.addToAllExistingProjects) {
      await this.addTaskToAllActiveProjects(membership.organizationId, next)
    }
    return this.mapTaskRow(next)
  }

  async archive(membership: ActiveMembership, id: string) {
    const t = await this.getOrgTask(membership, id)
    if (t.isArchived) {
      return { id: t.id, archived: true as const }
    }
    await this.prisma.task.update({
      where: { id: t.id },
      data: { isArchived: true },
    })
    return { id: t.id, archived: true as const }
  }

  async bulkArchive(membership: ActiveMembership, ids: string[]) {
    if (!ids.length) {
      return { updated: 0 }
    }
    if (ids.length > 200) {
      throw new BadRequestException('一次最多处理 200 个任务')
    }
    const result = await this.prisma.task.updateMany({
      where: {
        organizationId: membership.organizationId,
        id: { in: ids },
        isArchived: false,
      },
      data: { isArchived: true },
    })
    return { updated: result.count }
  }

  async delete(membership: ActiveMembership, id: string) {
    const t = await this.getOrgTask(membership, id)
    const withUsage = await this.prisma.projectTask.findFirst({
      where: { taskId: t.id },
      include: { timeEntries: { take: 1 } },
    })
    if (withUsage?.timeEntries.length) {
      throw new BadRequestException('该任务已有工时记录，请使用「归档」而非删除')
    }
    // 仍可能有无工时的项目关联
    await this.prisma.$transaction([
      this.prisma.projectTask.deleteMany({ where: { taskId: t.id } }),
      this.prisma.task.delete({ where: { id: t.id } }),
    ])
    return { id: t.id, deleted: true as const }
  }

  /**
   * 与 list 同筛选；用于导出。
   */
  async getRowsForExport(membership: ActiveMembership, q?: string) {
    const trimmed = q?.trim() ?? ''
    const where: Prisma.TaskWhereInput = {
      organizationId: membership.organizationId,
      isArchived: false,
    }
    if (trimmed) {
      where.name = { contains: trimmed, mode: 'insensitive' }
    }
    return this.prisma.task.findMany({
      where,
      orderBy: [{ isCommon: 'desc' }, { name: 'asc' }],
    })
  }

  buildCsv(
    tasks: { name: string; isCommon: boolean; isBillable: boolean; defaultHourlyRate: Prisma.Decimal | null }[],
  ) {
    const lines = [
      'name,isCommon,isBillable,defaultHourlyRate',
      ...tasks.map((t) => {
        const name = t.name.replace(/"/g, '""')
        return `"${name}",${t.isCommon},${t.isBillable},${t.defaultHourlyRate?.toString() ?? ''}`
      }),
    ]
    return lines.join('\r\n')
  }

  buildJson(
    tasks: { name: string; isCommon: boolean; isBillable: boolean; defaultHourlyRate: Prisma.Decimal | null }[],
  ) {
    return {
      version: 1,
      items: tasks.map((t) => ({
        name: t.name,
        isCommon: t.isCommon,
        isBillable: t.isBillable,
        defaultHourlyRate: t.defaultHourlyRate?.toString() ?? null,
      })),
    }
  }
}

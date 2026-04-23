import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { OrganizationContextService } from '../organization/organization-context.service'
import { BulkIdsDto } from './dto/bulk-ids.dto'
import { CreateTaskDto } from './dto/create-task.dto'
import { UpdateTaskDto } from './dto/update-task.dto'
import { TasksService } from './tasks.service'

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '组织任务：Common / Other 分类列表' })
  @ApiQuery({ name: 'q', required: false, description: '按名称包含筛选' })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Query('q') q?: string,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.list(membership, q)
  }

  @Get('export')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '导出组织任务' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  async exportList(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
    @Query('q') q?: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    const rows = await this.tasksService.getRowsForExport(membership, q)
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.json"')
      return this.tasksService.buildJson(rows)
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"')
    const body = this.tasksService.buildCsv(rows)
    return `\uFEFF${body}`
  }

  @Get(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '单个任务' })
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.getOne(membership, id)
  }

  @Post()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '新建任务' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: CreateTaskDto,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.create(membership, dto)
  }

  @Post('batch/archive')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '批量归档' })
  async bulkArchive(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() body: BulkIdsDto,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.bulkArchive(membership, body.ids)
  }

  @Patch(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '更新任务' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.update(membership, id, dto)
  }

  @Post(':id/archive')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '归档任务' })
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.archive(membership, id)
  }

  @Delete(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '删除任务（无工时 & 可移除项目关联时）' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.tasksService.delete(membership, id)
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { OrganizationContextService } from '../organization/organization-context.service'
import { CreateTimeEntryDto } from './dto/create-time-entry.dto'
import { ListTimeEntriesQueryDto } from './dto/list-time-entries.query.dto'
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto'
import { CopyFromRecentDayDto } from './dto/copy-from-recent-day.dto'
import { SubmitWeekDto } from './dto/submit-week.dto'
import { StartTimeEntryTimerDto } from './dto/start-time-entry-timer.dto'
import { TimeEntriesService } from './time-entries.service'

@ApiTags('time-entries')
@ApiBearerAuth()
@Controller('time-entries')
export class TimeEntriesController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly timeEntries: TimeEntriesService,
  ) {}

  @Get('assignable-rows')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '可填报工时的项目-任务行（含分配过滤）' })
  async assignableRows(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.listAssignableRows(membership, user)
  }

  @Get('track-time-options')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: 'Track time 弹窗：项目（含客户）及项目下任务，一次返回',
  })
  async trackTimeOptions(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.listTrackTimeOptions(membership, user)
  }

  @Get()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: '查询工时',
    description:
      '按周或月。未传 `week`/`month` 时默认当前 ISO 周。`forUser` 仅管理员/经理可用。',
  })
  async list(
    @Query() q: ListTimeEntriesQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.list(membership, user, q)
  }

  @Post('submit-week')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '提交/锁定该周（以 weekOf 所在 ISO 周）内全部未锁定记录' })
  async submitWeek(
    @Body() body: SubmitWeekDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.submitWeek(membership, user, body)
  }

  @Post('withdraw-week')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '撤回该周内已锁定记录（已提交/已批准均可解锁）' })
  async withdrawWeek(
    @Body() body: SubmitWeekDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.withdrawWeek(membership, user, body)
  }

  @Post('copy-from-recent-day')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary:
      '在目标日 `date` 之前、最近一次有工时的「那一整天」复制到 `date`（按项目任务+工时+备注新建行，受单日 24h 等约束）',
  })
  async copyFromRecentDay(
    @Body() body: CopyFromRecentDayDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.copyFromMostRecentDay(membership, user, body)
  }

  @Post('copy-from-recent-week')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary:
      '以 `weekOf` 所在月内「上一 ISO 周」为来源，将整周条目按星期对齐复制到该周；若该月内已是第一周则来源为上一自然 ISO 周',
  })
  async copyFromRecentWeek(
    @Body() body: SubmitWeekDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.copyFromPreviousWeekInMonth(membership, user, body)
  }

  @Get('timer/active')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '当前运行中的计时器（用于刷新恢复）' })
  async activeTimer(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.timeEntries.getActiveTimer(membership, user)
  }

  @Post('timer/start')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '开始计时：落库一条 RUNNING 计时器（会停止旧的）' })
  async startTimer(
    @Body() body: StartTimeEntryTimerDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.timeEntries.startTimer(membership, user, body)
  }

  @Post('timer/:id/stop')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '停止计时：标记 STOPPED 并按耗时生成工时记录' })
  async stopTimer(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.timeEntries.stopTimer(membership, user, id)
  }

  @Post()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '创建/覆盖当日同一项目任务行（0 工时可清空）' })
  async create(
    @Body() body: CreateTimeEntryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.create(membership, user, body)
  }

  @Post(':id/approve')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '审批通过（管理员/经理）' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.approve(membership, id)
  }

  @Patch(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '更新单条（未锁定）' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTimeEntryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.timeEntries.update(membership, user, id, body)
  }

  @Delete(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @HttpCode(204)
  @ApiOperation({ summary: '删除单条（未锁定）' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    await this.timeEntries.remove(membership, user, id)
  }
}

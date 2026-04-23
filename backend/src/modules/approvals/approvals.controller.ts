import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { OrganizationContextService } from '../organization/organization-context.service'
import { ApprovalsApproveGroupBodyDto, ApprovalsViewQueryDto } from './dto/approvals-view-query.dto'
import { ApprovalsService } from './approvals.service'

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly approvals: ApprovalsService,
  ) {}

  @Get('meta')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: 'Approvals page enums (report period, grouping, entry status)',
  })
  async getMeta() {
    return this.approvals.getMeta()
  }

  @Get('filters')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Filter options: clients, projects, roles, teammates' })
  async getFilters(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.approvals.listFilters(m)
  }

  @Get()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: 'Aggregated list, summary, and rows (date range from client ReportPeriod)',
  })
  async getView(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Query() query: ApprovalsViewQueryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.approvals.getView(m, query)
  }

  @Post('approve')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: 'Approve submitted time and expenses in a group (lock entries, create Approval)',
  })
  async approve(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() body: ApprovalsApproveGroupBodyDto,
  ) {
    const m = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.approvals.approveGroup(m, user.userId, body)
  }

  @Post('approve-all')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Approve all pending items in every visible group' })
  async approveAll(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() body: ApprovalsViewQueryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.approvals.approveAllVisible(m, user.userId, body)
  }

  @Post('withdraw')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: 'Withdraw approval for a group (unlock, members can edit again)',
  })
  async withdraw(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() body: ApprovalsApproveGroupBodyDto,
  ) {
    const m = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.approvals.withdrawGroup(m, body)
  }

  @Post('notify')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Send email (stub until mailer is configured)' })
  async notify(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() body: ApprovalsApproveGroupBodyDto,
  ) {
    const m = await this.orgContext.getActiveMembership(user.userId, xOrganizationId)
    return this.approvals.notifyGroupStub(m, body)
  }
}

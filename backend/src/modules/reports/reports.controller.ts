import { Controller, Get, Headers, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { OrganizationContextService } from '../organization/organization-context.service'
import { ProfitabilityReportQueryDto } from './dto/profitability-report.query.dto'
import { TimeReportQueryDto } from './dto/time-report.query.dto'
import { ReportsService } from './reports.service'

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly reports: ReportsService,
  ) {}

  @Get('filters')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Report filter options (clients, projects, team, etc.)' })
  async filters(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.reports.getReportFilters(m)
  }

  @Get('time')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Time report by clients, projects, tasks, or team' })
  async time(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Query() query: TimeReportQueryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.reports.getTimeReport(m, query)
  }

  @Get('profitability')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Profitability report (revenue = hours × rate, costs = expenses)' })
  async profitability(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Query() query: ProfitabilityReportQueryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.reports.getProfitabilityReport(m, query)
  }
}

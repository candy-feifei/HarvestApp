import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import { InviteMemberDto } from './dto/invite-member.dto'
import { OrganizationContextService } from './organization-context.service'
import { OrganizationService } from './organization.service'

@ApiTags('organization')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly orgContext: OrganizationContextService,
  ) {}

  @Get('context')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '当前用户默认组织与默认货币（创建客户等表单用）' })
  getContext(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    return this.orgContext.getActiveMembership(user.userId, xOrganizationId)
  }

  @Get('members')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '当前组织下的成员（Team）' })
  async listMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.listMembers(m.organizationId)
  }

  @Post('members/invite')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '邀请成员加入组织并发邮件' })
  async inviteMember(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: InviteMemberDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.inviteMember(
      m.organizationId,
      m.organization.name,
      m.systemRole,
      dto,
    )
  }

  @Get()
  @ApiOperation({ summary: '用户列表（分页；后续扩展组织/团队）' })
  listUsers(@Query() query: PaginationQueryDto) {
    return this.organizationService.listUsersPaginated(
      query.page,
      query.pageSize,
    )
  }
}

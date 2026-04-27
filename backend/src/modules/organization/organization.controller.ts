import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import { CreateOrganizationRoleDto } from './dto/create-organization-role.dto'
import { InviteMemberDto } from './dto/invite-member.dto'
import { CreateMemberRateDto } from './dto/create-member-rate.dto'
import { TeamWeeklyQueryDto } from './dto/team-weekly.query.dto'
import { UpdateMemberRateDto } from './dto/update-member-rate.dto'
import { SetMemberPasswordDto } from './dto/set-member-password.dto'
import { UpdateMemberDto } from './dto/update-member.dto'
import { UpdateOrganizationRoleDto } from './dto/update-organization-role.dto'
import {
  ProjectAssignmentsQueryDto,
  SetMemberProjectAssignmentsDto,
} from './dto/member-project-assignments.dto'
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

  @Get('roles')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '组织自定义角色（Team → Roles）' })
  async listOrganizationRoles(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.listOrganizationRoles(m.organizationId)
  }

  @Post('roles')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '创建自定义角色并分配成员' })
  async createOrganizationRole(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: CreateOrganizationRoleDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.createOrganizationRole(
      m.organizationId,
      m.systemRole,
      dto,
    )
  }

  @Patch('roles/:roleId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '更新角色名称与成员' })
  async updateOrganizationRole(
    @Param('roleId') roleId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: UpdateOrganizationRoleDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.updateOrganizationRole(
      m.organizationId,
      roleId,
      m.systemRole,
      dto,
    )
  }

  @Delete('roles/:roleId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '删除自定义角色' })
  async deleteOrganizationRole(
    @Param('roleId') roleId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.deleteOrganizationRole(
      m.organizationId,
      m.systemRole,
      roleId,
    )
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

  @Get('members/archived')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '已归档成员列表（从团队列表隐藏的成员）' })
  async listArchivedMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.listArchivedMembers(m.organizationId)
  }

  @Get('members/:memberId')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '获取成员详情（编辑页）' })
  async getMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.getMember(m.organizationId, memberId)
  }

  @Post('members/:memberId/resend-invitation')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '重新发送邀请邮件（仅 invited）' })
  async resendInvitation(
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.resendInvitation(
      m.organizationId,
      m.organization.name,
      m.systemRole,
      memberId,
    )
  }

  @Patch('members/:memberId')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '更新成员基本信息（编辑页保存）' })
  async updateMember(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.updateMember(
      m.organizationId,
      memberId,
      dto,
      m.systemRole,
    )
  }

  @Post('members/:memberId/password')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '管理员为成员设置新登录密码（Security 页）' })
  async setMemberPassword(
    @Param('memberId') memberId: string,
    @Body() dto: SetMemberPasswordDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.setMemberPassword(
      m.organizationId,
      memberId,
      dto,
      m.systemRole,
    )
  }

  @Get('members/:memberId/rates')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '成员 rates 历史（默认费率）' })
  async listMemberRates(
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.listMemberRates(m.organizationId, memberId)
  }

  @Post('members/:memberId/rates')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '新增成员 default rate（按 startDate 生效）' })
  async createMemberRate(
    @Param('memberId') memberId: string,
    @Body() dto: CreateMemberRateDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.createMemberRate(
      m.organizationId,
      m.systemRole,
      memberId,
      dto,
    )
  }

  @Patch('members/:memberId/rates/:rateId')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '更新成员某条 default rate 记录' })
  async updateMemberRate(
    @Param('memberId') memberId: string,
    @Param('rateId') rateId: string,
    @Body() dto: UpdateMemberRateDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.updateMemberRate(
      m.organizationId,
      m.systemRole,
      memberId,
      rateId,
      dto,
    )
  }

  @Delete('members/:memberId/rates/:rateId')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '删除成员某条 rate 历史' })
  async deleteMemberRate(
    @Param('memberId') memberId: string,
    @Param('rateId') rateId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.deleteMemberRate(
      m.organizationId,
      m.systemRole,
      memberId,
      rateId,
    )
  }

  @Get('members/:memberId/project-assignments')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '成员可分配项目（按客户分组）与当前分配状态' })
  async getMemberProjectAssignments(
    @Param('memberId') memberId: string,
    @Query() q: ProjectAssignmentsQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.getMemberProjectAssignments(
      m.organizationId,
      memberId,
      q.q,
    )
  }

  @Put('members/:memberId/project-assignments')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '设置成员项目分配与「未来项目自动加入」' })
  async setMemberProjectAssignments(
    @Param('memberId') memberId: string,
    @Body() dto: SetMemberProjectAssignmentsDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.setMemberProjectAssignments(
      m.organizationId,
      m.systemRole,
      memberId,
      dto,
    )
  }

  @Post('members/:memberId/archive')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '归档成员（从团队列表隐藏，可数据保留）' })
  async archiveMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.archiveMember(
      m.organizationId,
      memberId,
      m.systemRole,
      user.userId,
    )
  }

  @Post('members/:memberId/restore')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '恢复已归档成员（重新加入团队列表）' })
  async restoreMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.restoreMember(
      m.organizationId,
      memberId,
      m.systemRole,
      user.userId,
    )
  }

  @Delete('members/:memberId')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: '从组织删除成员' })
  async removeMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.removeMember(
      m.organizationId,
      memberId,
      m.systemRole,
      user.userId,
    )
  }

  @Get('team/weekly')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({
    summary: 'Team：按 ISO 周汇总（列表页用）',
    description:
      '返回本周总工时、可计费/不可计费拆分、团队容量与成员明细（含 utilization）。',
  })
  async teamWeeklySummary(
    @Query() q: TeamWeeklyQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.organizationService.getTeamWeeklySummary(m.organizationId, q.week)
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

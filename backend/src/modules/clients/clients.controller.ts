import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { OrganizationContextService } from '../organization/organization-context.service'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly clientsService: ClientsService,
  ) {}

  @Get()
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '客户列表（可按名称或联系人筛选）' })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Query('q') q?: string,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.clientsService.list(membership, q)
  }

  @Get(':id')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '获取单个客户' })
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.clientsService.getOne(membership, id)
  }

  @Post()
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
    description: '可选，指定要操作的组织；省略则使用当前用户默认组织',
  })
  @ApiOperation({ summary: '创建客户' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: CreateClientDto,
  ) {
    const membership = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.clientsService.create(membership, dto)
  }
}

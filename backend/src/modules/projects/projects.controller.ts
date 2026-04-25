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
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import { ProjectsService } from './projects.service'

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '项目列表（分页，按组织）' })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    return this.projectsService.listProjectsPaginated(
      query.page,
      query.pageSize,
      user,
      xOrganizationId,
    );
  }

  @Get(':id')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '项目详情' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    return this.projectsService.getById(id, user, xOrganizationId);
  }

  @Post()
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '创建项目' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user, xOrganizationId, dto);
  }

  @Patch(':id')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '更新项目' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user, xOrganizationId, id, dto);
  }

  @Delete(':id')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: false,
  })
  @ApiOperation({ summary: '删除项目' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    return this.projectsService.remove(user, xOrganizationId, id);
  }
}

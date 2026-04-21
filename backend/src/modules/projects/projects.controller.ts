import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({
    summary: '项目列表（分页）',
    description:
      '需 Bearer JWT；`@CurrentUser()` 从令牌解析当前用户，可在 Service 中做数据范围控制。',
  })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.projectsService.listProjectsPaginated(
      query.page,
      query.pageSize,
      user,
    );
  }
}

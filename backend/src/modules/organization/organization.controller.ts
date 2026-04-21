import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organization')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: '用户列表（分页；后续扩展组织/团队）' })
  listUsers(@Query() query: PaginationQueryDto) {
    return this.organizationService.listUsersPaginated(
      query.page,
      query.pageSize,
    );
  }
}

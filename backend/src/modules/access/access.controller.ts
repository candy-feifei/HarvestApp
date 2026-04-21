import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('access')
@ApiBearerAuth()
@Controller('roles')
export class AccessController {
  @Get()
  @ApiOperation({ summary: '角色列表（占位，与 RBAC 对齐）' })
  list() {
    return { items: [], module: 'access' };
  }
}

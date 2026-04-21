import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  @Get()
  @ApiOperation({ summary: '报表占位' })
  summary() {
    return { module: 'reports', charts: [] };
  }
}

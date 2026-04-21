import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('time-entries')
@ApiBearerAuth()
@Controller('time-entries')
export class TimeEntriesController {
  @Get()
  @ApiOperation({ summary: '时间记录列表（占位）' })
  list() {
    return { items: [], module: 'time-entries' };
  }
}

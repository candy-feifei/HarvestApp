import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  @Get()
  @ApiOperation({ summary: '任务列表（占位）' })
  list() {
    return { items: [], module: 'tasks' };
  }
}

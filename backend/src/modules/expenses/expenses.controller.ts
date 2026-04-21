import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  @Get()
  @ApiOperation({ summary: '发票/费用列表（占位）' })
  list() {
    return { items: [], module: 'expenses' };
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  @Get()
  @ApiOperation({ summary: '基础设置（占位）' })
  get() {
    return { module: 'settings', values: {} };
  }
}

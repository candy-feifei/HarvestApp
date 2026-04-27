import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, Matches } from 'class-validator'

export class TeamWeeklyQueryDto {
  @ApiPropertyOptional({
    description:
      '任意一天（YYYY-MM-DD）。后端会自动归一到该日期所在的 ISO 周（周一开始）',
    example: '2026-04-20',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'week 格式应为 YYYY-MM-DD' })
  week?: string
}


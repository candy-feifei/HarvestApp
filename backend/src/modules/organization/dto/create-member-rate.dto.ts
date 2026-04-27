import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

export class CreateMemberRateDto {
  @ApiPropertyOptional({ example: 120, description: '默认可计费率（美元/时）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999.99)
  billableRatePerHour?: number;

  @ApiPropertyOptional({ example: 60, description: '成本率（美元/时）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999.99)
  costRatePerHour?: number;

  @ApiPropertyOptional({
    description:
      '生效日期（YYYY-MM-DD）。后端会归一到 UTC 当天 00:00:00，作为该费率的 startDate。',
    example: '2026-05-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate 格式应为 YYYY-MM-DD' })
  startDate?: string;
}


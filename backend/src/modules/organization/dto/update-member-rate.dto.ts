import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

export class UpdateMemberRateDto {
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
    description: '新的生效开始日期（YYYY-MM-DD，UTC 当天 00:00:00）',
    example: '2026-05-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate 格式应为 YYYY-MM-DD' })
  startDate?: string;
}

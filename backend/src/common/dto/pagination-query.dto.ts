import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * 通用分页查询：用于 GET `?page=&pageSize=`。
 * 缺省或非法值时回退为默认值，避免 query 缺失导致 NaN。
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: '页码，从 1 开始',
    default: 1,
    minimum: 1,
  })
  @Transform(({ value }) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: '每页条数',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Transform(({ value }) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 20;
    return Math.min(100, Math.floor(n));
  })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

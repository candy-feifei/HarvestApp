import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, Matches, ValidateIf } from 'class-validator'

export class ListTimeEntriesQueryDto {
  @ApiPropertyOptional({ description: '该 ISO 周；可给该周任一天，将取当周一 0:00 起 7 天' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  week?: string

  @ApiPropertyOptional({ example: '2026-04', description: 'YYYY-MM 月视图' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @Matches(/^\d{4}-\d{2}$/)
  month?: string

  @ApiPropertyOptional({ description: '仅管理员/经理可查看其他成员；默认当前用户' })
  @IsOptional()
  @IsUUID('4')
  forUser?: string
}

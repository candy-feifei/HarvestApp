import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCommon?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean

  @ApiPropertyOptional({ nullable: true, description: '传 null 可清除默认时薪' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'defaultHourlyRate 需为有效金额' })
  @Min(0, { message: '时薪不能为负数' })
  @Max(1_000_000, { message: '时薪超出上限' })
  defaultHourlyRate?: number | null

  @ApiPropertyOptional({ description: '为 true 时将本任务补录到所有尚未包含它的现有非归档项目' })
  @IsOptional()
  @IsBoolean()
  addToAllExistingProjects?: boolean
}

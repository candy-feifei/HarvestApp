import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator'

export class CreateTimeEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  projectTaskId!: string

  /** 工作日期，YYYY-MM-DD */
  @ApiProperty({ example: '2026-04-23' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string

  @ApiProperty({ example: 2.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  hours!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}

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

  @ApiPropertyOptional({ nullable: true, description: 'Set to null to clear the default rate' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'defaultHourlyRate must be a valid amount' },
  )
  @Min(0, { message: 'Hourly rate cannot be negative' })
  @Max(1_000_000, { message: 'Hourly rate exceeds the maximum' })
  defaultHourlyRate?: number | null

  @ApiPropertyOptional({
    description:
      'When true, add this task to every non-archived project that does not already include it',
  })
  @IsOptional()
  @IsBoolean()
  addToAllExistingProjects?: boolean
}

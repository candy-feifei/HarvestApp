import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateTaskDto {
  @ApiProperty({ example: 'Design' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string

  @ApiProperty({
    description:
      'Whether this is an organization-wide common task (included in new projects by default)',
  })
  @IsBoolean()
  isCommon!: boolean

  @ApiProperty({ description: 'Whether new time entries / project links are billable by default' })
  @IsBoolean()
  isBillable!: boolean

  @ApiPropertyOptional({
    description: 'Default billable hourly rate; project/client may override if unset',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'defaultHourlyRate must be a valid amount' },
  )
  @Min(0, { message: 'Hourly rate cannot be negative' })
  @Max(1_000_000, { message: 'Hourly rate exceeds the maximum' })
  defaultHourlyRate?: number

  @ApiPropertyOptional({
    description: 'Add this task to all existing non-archived projects in the org',
  })
  @IsOptional()
  @IsBoolean()
  addToAllExistingProjects?: boolean
}

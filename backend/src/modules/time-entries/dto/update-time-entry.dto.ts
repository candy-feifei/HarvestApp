import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class UpdateTimeEntryDto {
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  hours?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}

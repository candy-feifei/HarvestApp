import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator'

export class ProjectTaskLineDto {
  @ApiProperty()
  @IsUUID()
  taskId!: string

  @ApiProperty()
  @IsBoolean()
  isBillable!: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number
}

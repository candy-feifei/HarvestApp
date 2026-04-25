import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator'

export class ProjectAssignmentLineDto {
  @ApiProperty()
  @IsUUID()
  userId!: string

  @ApiProperty()
  @IsBoolean()
  isManager!: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  projectBillableRate?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  projectCostRate?: number
}

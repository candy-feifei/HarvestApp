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
  @ApiProperty({ example: '设计' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string

  @ApiProperty({ description: '是否为组织级通用任务（会加入新项目的默认任务集）' })
  @IsBoolean()
  isCommon!: boolean

  @ApiProperty({ description: '新工时/加入项目时是否默认可计费' })
  @IsBoolean()
  isBillable!: boolean

  @ApiPropertyOptional({ description: '默认可计费时薪；未填则由项目/客户覆盖' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'defaultHourlyRate 需为有效金额' })
  @Min(0, { message: '时薪不能为负数' })
  @Max(1_000_000, { message: '时薪超出上限' })
  defaultHourlyRate?: number

  @ApiPropertyOptional({ description: '将本任务补录到所有现有非归档项目' })
  @IsOptional()
  @IsBoolean()
  addToAllExistingProjects?: boolean
}

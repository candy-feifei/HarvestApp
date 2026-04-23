import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { EmploymentType } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class InviteMemberDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  firstName!: string

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  lastName!: string

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  workEmail!: string

  @ApiPropertyOptional({ description: '组织内员工唯一标识' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employeeId?: string

  @ApiProperty({ enum: EmploymentType, default: EmploymentType.EMPLOYEE })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  jobLabel?: string

  @ApiProperty({ example: 35, description: '每周可用小时' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(168)
  weeklyCapacity!: number

  @ApiPropertyOptional({ example: 120, description: '默认可计费率，美元/时' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999.99)
  defaultBillableRatePerHour?: number

  @ApiPropertyOptional({ example: 60, description: '内部成本率，美元/时' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999.99)
  costRatePerHour?: number
}

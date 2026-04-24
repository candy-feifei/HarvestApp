import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingMethod, BudgetType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 'Website redesign' })
  @IsString()
  @MaxLength(500)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiProperty({ enum: BillingMethod, default: BillingMethod.TM })
  @IsEnum(BillingMethod)
  billingMethod!: BillingMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedFee?: number;

  @ApiProperty({ enum: BudgetType, default: BudgetType.NO_BUDGET })
  @IsEnum(BudgetType)
  budgetType!: BudgetType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  notifyAt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'ISO 日期时间' })
  @IsOptional()
  @IsString()
  startsOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endsOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'JSON：billableRateMode、team、tasks、invoice、spentAmount 等',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

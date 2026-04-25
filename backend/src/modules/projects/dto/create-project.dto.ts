import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingMethod, BudgetType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProjectAssignmentLineDto } from './project-assignment-line.dto';
import { ProjectTaskLineDto } from './project-task-line.dto';

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
    description:
      'JSON: billableRateMode, invoice, spentAmount, etc. (tasks/team use `tasks` / `assignments` fields)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [ProjectTaskLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectTaskLineDto)
  tasks?: ProjectTaskLineDto[];

  @ApiPropertyOptional({ type: [ProjectAssignmentLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectAssignmentLineDto)
  assignments?: ProjectAssignmentLineDto[];
}

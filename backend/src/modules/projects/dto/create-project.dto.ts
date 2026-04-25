import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingMethod, BudgetType, InvoiceDueMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
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

  @ApiPropertyOptional({ enum: InvoiceDueMode, default: InvoiceDueMode.UPON_RECEIPT })
  @IsOptional()
  @IsEnum(InvoiceDueMode)
  invoiceDueMode?: InvoiceDueMode;

  @ApiPropertyOptional({ description: '当 invoiceDueMode 为 NET_DAYS 时建议提供' })
  @ValidateIf((o: CreateProjectDto) => o.invoiceDueMode === 'NET_DAYS')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  invoiceNetDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  invoicePoNumber?: string;

  @ApiPropertyOptional({ description: '主税率 0–100' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  invoiceTaxPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  invoiceSecondTaxEnabled?: boolean;

  @ApiPropertyOptional({ description: '第二税率 0–100' })
  @ValidateIf((o: CreateProjectDto) => Boolean(o.invoiceSecondTaxEnabled))
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  invoiceSecondTaxPercent?: number;

  @ApiPropertyOptional({ description: '折扣 0–100' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  invoiceDiscountPercent?: number;

  @ApiPropertyOptional({
    description:
      'JSON: billableRateMode, spentAmount, etc. (tasks/team 用 `tasks` / `assignments`；发票用表字段)',
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

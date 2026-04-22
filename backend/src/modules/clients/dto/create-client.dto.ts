import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InvoiceDueMode } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional({ description: '多行地址' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  address?: string

  /**
   * ISO-4217 三位大写；省略或 `null` 表示使用组织账户默认货币
   */
  @ApiPropertyOptional({ example: 'USD', nullable: true })
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string | null

  @ApiProperty({ enum: InvoiceDueMode })
  @IsEnum(InvoiceDueMode)
  invoiceDueMode!: InvoiceDueMode

  @ApiPropertyOptional({ description: '账期为「发票后 N 天」时必填' })
  @ValidateIf((o: CreateClientDto) => o.invoiceDueMode === 'NET_DAYS')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  invoiceNetDays?: number

  @ApiPropertyOptional({ description: '主税率 0–100' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number

  @ApiPropertyOptional({ description: '是否启用第二税率' })
  @IsOptional()
  @IsBoolean()
  secondaryTaxEnabled?: boolean

  @ApiPropertyOptional({ description: '第二税率 0–100' })
  @ValidateIf((o: CreateClientDto) => Boolean(o.secondaryTaxEnabled))
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  secondaryTaxRate?: number

  @ApiPropertyOptional({ description: '折扣 0–100' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate?: number
}

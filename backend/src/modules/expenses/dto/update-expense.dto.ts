import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator'

export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString()
  spentDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number

  @IsOptional()
  @IsString()
  notes?: string | null

  @IsOptional()
  @IsString()
  receiptUrl?: string | null

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBillable?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isReimbursable?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitQuantity?: number | null

  @IsOptional()
  @IsUUID()
  projectId?: string

  @IsOptional()
  @IsUUID()
  categoryId?: string
}

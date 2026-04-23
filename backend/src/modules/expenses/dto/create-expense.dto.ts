import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator'

export class CreateExpenseDto {
  @IsDateString()
  spentDate!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  receiptUrl?: string

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
  unitQuantity?: number

  @IsUUID()
  @IsNotEmpty()
  projectId!: string

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string
}

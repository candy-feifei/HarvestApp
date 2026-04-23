import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasUnitPrice?: boolean

  @IsOptional()
  @IsString()
  unitName?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number
}

import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isArchived?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasUnitPrice?: boolean

  @IsOptional()
  @IsString()
  unitName?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number | null
}

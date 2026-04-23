import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator'

export class ListExpenseQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string

  /** When true, list all members' expenses in the org (ignores userId) */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @Type(() => Boolean)
  @IsBoolean()
  includeAllMembers?: boolean

  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}

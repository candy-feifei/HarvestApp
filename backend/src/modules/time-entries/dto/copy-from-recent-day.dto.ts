import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class CopyFromRecentDayDto {
  /** 要复制到的自然日 YYYY-MM-DD（UTC 日界，与 `create` 的 `date` 一致） */
  @ApiProperty({ example: '2026-04-23' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string
}

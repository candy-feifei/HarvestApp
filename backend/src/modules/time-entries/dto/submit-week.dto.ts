import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class SubmitWeekDto {
  /** 该周任意一天，服务端按周一起算；YYYY-MM-DD */
  @ApiProperty({ example: '2026-04-21' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekOf!: string
}

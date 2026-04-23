import { ApiProperty } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsString } from 'class-validator'

export class BulkIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[]
}

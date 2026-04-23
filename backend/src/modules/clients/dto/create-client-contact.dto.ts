import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateClientContactDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MaxLength(100)
  firstName!: string

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MaxLength(100)
  lastName!: string

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string

  @ApiPropertyOptional({ example: 'Account Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  officeNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  mobileNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  faxNumber?: string
}

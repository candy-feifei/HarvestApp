import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';



export class RegisterDto {

  @ApiProperty({ example: 'name@company.com' })

  @IsEmail()

  email: string;



  @ApiProperty({ example: 'Str0ng#Pass', minLength: 8 })

  @IsString()

  @MinLength(8)

  password: string;



  @ApiPropertyOptional({ example: '张三' })

  @IsOptional()

  @IsString()

  @MaxLength(120)

  name?: string;

}


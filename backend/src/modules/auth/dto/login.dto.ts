import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@harvest.app' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'demo123', minLength: 4 })
  @IsString()
  @MinLength(4)
  password: string;
}

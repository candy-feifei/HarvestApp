import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateOrganizationRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: '置空则传 []，未传则不改' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberUserOrganizationIds?: string[];
}

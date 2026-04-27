import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class MemberProjectAssignmentLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isManager?: boolean;
}

export class SetMemberProjectAssignmentsDto {
  @ApiProperty({ type: [MemberProjectAssignmentLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberProjectAssignmentLineDto)
  assignments!: MemberProjectAssignmentLineDto[];

  @ApiPropertyOptional({ description: '新创建的项目也自动加入该成员' })
  @IsOptional()
  @IsBoolean()
  assignAllFutureProjects?: boolean;
}

export class ProjectAssignmentsQueryDto {
  @ApiPropertyOptional({ description: '按客户名、项目名、code 搜索（不区分大小写）' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, SystemRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Manager 的 8 个可选子权限（Harvest 风格；仅 systemRole=MANAGER 时生效） */
export class ManagerPermissionsDto {
  @ApiPropertyOptional()
  @IsBoolean() createEditManagedProjects!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() createEditAllClientsTasks!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() createEditTimeExpensesManaged!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() seeEditBillableRatesManaged!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() createEditDraftInvoices!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() manageAllInvoices!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() createEditAllEstimates!: boolean;
  @ApiPropertyOptional()
  @IsBoolean() withdrawApprovals!: boolean;
}

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional({ description: '工作邮箱（会同步到 user.email）' })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  workEmail?: string;

  @ApiPropertyOptional({ description: '组织内员工唯一标识' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employeeId?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: '自由文本角色标签' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  jobLabel?: string;

  @ApiPropertyOptional({ example: 40, description: '每周可用小时' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(168)
  weeklyCapacity?: number;

  @ApiPropertyOptional({
    description: 'IANA 时区名，如 Asia/Shanghai、America/New_York',
    example: 'Asia/Shanghai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @ApiPropertyOptional({ enum: SystemRole, description: '系统角色；仅组织管理员可修改' })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @ApiPropertyOptional({ type: () => ManagerPermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ManagerPermissionsDto)
  managerPermissions?: ManagerPermissionsDto;

  @ApiPropertyOptional({ description: '在团队 Members 列表中置顶' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: '用户头像地址（可传空串清除）' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  avatarUrl?: string;

  @ApiPropertyOptional({ description: '工时报经其管理的人提交时发邮件' })
  @IsOptional()
  @IsBoolean()
  emailNotifyManagedPeopleTimesheets?: boolean;

  @ApiPropertyOptional({ description: '工时报经其负责的项目时发邮件' })
  @IsOptional()
  @IsBoolean()
  emailNotifyManagedProjectTimesheets?: boolean;
}

import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * 启动时校验环境变量，避免「配置写错到运行时才爆」。
 * DATABASE_URL 在本地仅跑 API、不接库时可暂不配置（Prisma 调用会失败，健康检查仍可用）。
 */
class EnvironmentVariables {
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  /** 自助注册，设为 false 时 POST /auth/register 拒绝 */
  @IsOptional()
  @IsString()
  AUTH_ALLOW_REGISTRATION?: string;

  @IsOptional()
  @IsString()
  AUTH_MAX_FAILED_LOGINS?: string;

  @IsOptional()
  @IsString()
  AUTH_LOCKOUT_MINUTES?: string;

  @IsOptional()
  @IsString()
  AUTH_RESET_TOKEN_MINUTES?: string;

  /** 邮件内重置链接、前端站点的公开根 URL，无尾斜杠 */
  @IsOptional()
  @IsString()
  APP_PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsString()
  SMTP_PORT?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    const msg = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`环境变量校验失败: ${msg}`);
  }
  return validated;
}

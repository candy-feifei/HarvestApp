import type { ConfigService } from '@nestjs/config';

/** 开发缺省密钥：生产环境必须在环境变量中设置 JWT_SECRET */
export function resolveJwtSecret(config: ConfigService): string {
  return config.get<string>('JWT_SECRET') ?? 'dev-insecure-change-me';
}

/**
 * 将 `7d` / `12h` / `30m` / `60s` 转为秒，供 JWT `expiresIn`（数字秒）使用。
 */
export function parseDurationToSeconds(input: string): number {
  const m = /^(\d+)([smhd])$/i.exec(input.trim());
  if (!m) {
    return 7 * 24 * 3600;
  }
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  switch (u) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return 7 * 24 * 3600;
  }
}

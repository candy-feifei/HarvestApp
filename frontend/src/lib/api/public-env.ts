/** 与 NestJS 对齐的公开环境变量读取，避免在业务代码中散落 import.meta.env */
export function getPublicApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  return typeof raw === 'string' && raw.length > 0 ? raw.replace(/\/$/, '') : ''
}

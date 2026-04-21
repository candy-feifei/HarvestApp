import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

/** 标记路由无需 JWT（如登录、健康检查、OpenAPI 文档） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

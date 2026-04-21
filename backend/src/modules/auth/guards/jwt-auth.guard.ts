import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/constants/auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ path?: string }>();
    const path = request.path ?? '';
    // Swagger UI 由框架注册，无法挂 @Public，在此放行（生产可改网关鉴权或关文档）
    if (path.includes('/docs')) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | undefined, user: TUser | false): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('未登录或令牌无效');
    }
    return user;
  }
}

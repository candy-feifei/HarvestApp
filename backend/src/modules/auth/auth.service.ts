import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parseDurationToSeconds } from '../../config/jwt.config';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 演示登录：与 .env 中 AUTH_DEMO_EMAIL / AUTH_DEMO_PASSWORD 比对后签发 JWT。
   * 生产环境请改为数据库用户 + bcrypt 等安全方案。
   */
  async login(dto: LoginDto) {
    const demoEmail =
      this.config.get<string>('AUTH_DEMO_EMAIL') ?? 'demo@harvest.app';
    const demoPassword =
      this.config.get<string>('AUTH_DEMO_PASSWORD') ?? 'demo123';

    if (dto.email !== demoEmail || dto.password !== demoPassword) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const ttl = parseDurationToSeconds(
      this.config.get<string>('JWT_EXPIRES_IN') ?? '7d',
    );
    const accessToken = await this.jwtService.signAsync(
      {
        sub: 'demo-user',
        email: dto.email,
      },
      { expiresIn: ttl },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer' as const,
      expires_in: ttl,
    };
  }
}

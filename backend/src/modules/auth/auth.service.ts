import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDurationToSeconds } from '../../config/jwt.config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from './mail.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private authTtlSeconds(): number {
    return parseDurationToSeconds(
      this.config.get<string>('JWT_EXPIRES_IN') ?? '7d',
    );
  }

  private maxFailedLogins(): number {
    return Number(this.config.get<string>('AUTH_MAX_FAILED_LOGINS') ?? 5);
  }

  private lockoutMinutes(): number {
    return Number(this.config.get<string>('AUTH_LOCKOUT_MINUTES') ?? 15);
  }

  private resetTokenMinutes(): number {
    return Number(this.config.get<string>('AUTH_RESET_TOKEN_MINUTES') ?? 60);
  }

  private publicAppUrl(): string {
    return (this.config.get<string>('APP_PUBLIC_URL') ?? 'http://127.0.0.1:5173')
      .replace(/\/$/, '');
  }

  private registrationAllowed(): boolean {
    return this.config.get<string>('AUTH_ALLOW_REGISTRATION') !== 'false';
  }

  private async signAccessToken(userId: string, email: string) {
    const ttl = this.authTtlSeconds();
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      { expiresIn: ttl },
    );
    return {
      access_token: accessToken,
      token_type: 'Bearer' as const,
      expires_in: ttl,
    };
  }

  private hashResetToken(plain: string): string {
    return createHash('sha256').update(plain, 'utf8').digest('hex');
  }

  private async logAttempt(
    email: string,
    userId: string | null,
    success: boolean,
    ip: string,
    userAgent: string | undefined,
    failureReason: string | null,
  ) {
    await this.prisma.loginAttempt.create({
      data: {
        email: email.toLowerCase(),
        userId,
        success,
        ip: ip || null,
        userAgent: userAgent ?? null,
        failureReason,
      },
    });
  }

  async register(dto: RegisterDto) {
    if (!this.registrationAllowed()) {
      throw new ForbiddenException('当前已关闭自助注册');
    }
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('该邮箱已被注册');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: (dto.name?.trim() || 'User').slice(0, 120),
        lastName: '',
        passwordHash,
        invitationStatus: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
    return this.signAccessToken(user.id, user.email);
  }

  async login(
    dto: LoginDto,
    ip: string,
    userAgent: string | undefined,
  ) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.logAttempt(
        email,
        null,
        false,
        ip,
        userAgent,
        'user_not_found',
      );
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      await this.logAttempt(
        email,
        user.id,
        false,
        ip,
        userAgent,
        'account_locked',
      );
      throw new ForbiddenException(
        '因多次失败尝试，账户已临时锁定，请稍后再试或使用忘记密码',
      );
    }

    if (!user.passwordHash) {
      await this.logAttempt(
        email,
        user.id,
        false,
        ip,
        userAgent,
        'no_local_password',
      );
      throw new UnauthorizedException('该账号未设置密码，请使用已绑定的第三方登录');
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      const max = this.maxFailedLogins();
      const lockMins = this.lockoutMinutes();
      const fails = user.failedLoginCount + 1;
      const lockedUntil =
        fails >= max
          ? new Date(Date.now() + lockMins * 60_000)
          : user.lockedUntil;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: fails, lockedUntil },
      });
      await this.logAttempt(
        email,
        user.id,
        false,
        ip,
        userAgent,
        'bad_password',
      );
      throw new UnauthorizedException('邮箱或密码错误');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });
    await this.logAttempt(email, user.id, true, ip, userAgent, null);
    return this.signAccessToken(user.id, user.email);
  }

  async requestPasswordReset(dto: ForgotPasswordDto, ip: string) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = { sent: true as const };
    if (!user?.passwordHash) {
      return generic;
    }
    const plain = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(plain);
    const expiresAt = new Date(
      Date.now() + this.resetTokenMinutes() * 60_000,
    );
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);
    const resetUrl = `${this.publicAppUrl()}/reset-password?token=${encodeURIComponent(plain)}`;
    const { sent } = await this.mail.sendPasswordResetEmail(user.email, resetUrl);
    await this.prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { emailSentAt: sent ? new Date() : null },
    });
    return generic;
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ip: string,
    userAgent: string | undefined,
  ) {
    const tokenHash = this.hashResetToken(dto.token);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    const now = new Date();
    if (
      !row ||
      row.usedAt ||
      row.expiresAt < now
    ) {
      throw new UnauthorizedException('链接无效或已过期');
    }
    const newHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: row.userId },
    });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
    ]);
    await this.logAttempt(user.email, user.id, true, ip, userAgent, null);
    return this.signAccessToken(user.id, user.email);
  }
}

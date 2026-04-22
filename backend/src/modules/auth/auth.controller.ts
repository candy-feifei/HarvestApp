import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Public()
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '注册（可配置关闭）' })
  register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    void ip;
    void userAgent;
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({ summary: '邮箱+密码 登录，返回 JWT' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @ApiOperation({ summary: '请求密码重置（总是返回成功提示，防枚举）' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string,
  ) {
    return this.authService.requestPasswordReset(dto, ip);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: '用邮件 token 重设密码并直接登录' })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.authService.resetPassword(dto, ip, userAgent);
  }
}

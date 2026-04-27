import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  parseDurationToSeconds,
  resolveJwtSecret,
} from '../../config/jwt.config';
import { AccountController } from './account.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ThrottlerModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = parseDurationToSeconds(
          config.get<string>('JWT_EXPIRES_IN') ?? '7d',
        );
        return {
          secret: resolveJwtSecret(config),
          signOptions: {
            expiresIn: ttl,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService, MailService, JwtStrategy, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard, AuthService, MailService],
})
export class AuthModule {}

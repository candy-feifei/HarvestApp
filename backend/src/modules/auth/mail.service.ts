import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly hasSmtp: boolean;
  private readonly from: string;
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST') ?? '';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER') ?? '';
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    this.from = this.config.get<string>('MAIL_FROM') ?? 'noreply@localhost';
    this.hasSmtp = Boolean(host);

    this.transporter = this.hasSmtp
      ? createTransport({
          host,
          port,
          secure: port === 465,
          auth: user ? { user, pass } : undefined,
        })
      : null;
  }

  /**
   * 未配置 SMTP 时仅打日志，便于开发；生产应配置发信以完成「邮件重置」闭环。
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
  ): Promise<{ sent: boolean }> {
    if (!this.transporter) {
      this.log.warn(`[开发模式] 未配置 SMTP，跳过发信。重置链接: ${resetUrl}`);
      return { sent: false };
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: '重置您的 HarvestApp 密码',
      text: `请打开以下链接重置密码（若未申请请忽略）：\n\n${resetUrl}\n`,
      html: `<p>请 <a href="${resetUrl}">点击此处</a> 重置密码。若未申请，请忽略本邮件。</p>`,
    });
    this.log.log(`已发送密码重置邮件至 ${to}`);
    return { sent: true };
  }
}

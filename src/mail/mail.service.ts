import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
  ): Promise<boolean> {
    console.log('Sending email to:', to);
    console.log('Email subject:', subject);
    console.log('Email template:', template);
    console.log('Email context:', context);

    try {
      await this.mailerService.sendMail({
        to,
        from: this.configService.get<string>('SENDER_EMAIL'),
        subject,
        template,
        context,
      });

      return true;
    } catch (error) {
      console.log('Error sending email:', error);

      return false;
    }
  }
}

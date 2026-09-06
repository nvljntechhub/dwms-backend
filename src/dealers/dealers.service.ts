import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomInt } from 'crypto';
import { Dealer } from './entities/dealer.entity';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { SendDealerEmailOtpDto } from './dto/send-dealer-email-otp.dto';
import { VerifyDealerEmailOtpDto } from './dto/verify-dealer-email-otp.dto';
import {
  emailSubject,
  emailTemplate,
  errorMessages,
} from 'src/utils/properties.utils';
import { resolveDealerCurrency } from 'src/common/utils/dealer-currency.utils';
import { requireDealerId } from 'src/common/utils/tenant-scope.utils';
import { MailService } from 'src/mail/mail.service';
import {
  DEALER_EMAIL_OTP_EXPIRY_SECONDS,
  DEALER_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  DEALER_EMAIL_OTP_VERIFIED_TTL_SECONDS,
} from './dealer-email-otp.constants';

@Injectable()
export class DealersService {
  constructor(
    @InjectRepository(Dealer)
    private readonly dealerRepository: Repository<Dealer>,
    @InjectRedis() private readonly redis: Redis,
    private readonly mailService: MailService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private otpKey(dealerId: string, email: string): string {
    return `dealer:email-otp:${dealerId}:${this.normalizeEmail(email)}`;
  }

  private otpCooldownKey(dealerId: string, email: string): string {
    return `dealer:email-otp-cooldown:${dealerId}:${this.normalizeEmail(email)}`;
  }

  private otpVerifiedKey(dealerId: string, email: string): string {
    return `dealer:email-verified:${dealerId}:${this.normalizeEmail(email)}`;
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async assertEmailAvailableForDealer(
    email: string,
    dealerId: string,
  ): Promise<void> {
    const existingDealer = await this.dealerRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });

    if (existingDealer && existingDealer.id !== dealerId) {
      throw new ConflictException(errorMessages.DEALER_EMAIL_EXISTS);
    }
  }

  async findMine(dealerId?: string | null): Promise<Dealer> {
    const scopedDealerId = requireDealerId(dealerId);
    const dealer = await this.dealerRepository.findOne({
      where: { id: scopedDealerId },
    });

    if (!dealer) {
      throw new NotFoundException(errorMessages.DEALER_NOT_FOUND);
    }

    return dealer;
  }

  async getCurrency(dealerId?: string | null): Promise<string> {
    const scopedDealerId = requireDealerId(dealerId);
    return resolveDealerCurrency(this.dealerRepository, scopedDealerId);
  }

  async sendEmailOtp(
    dealerId: string | null | undefined,
    dto: SendDealerEmailOtpDto,
  ): Promise<{ expiresInSeconds: number }> {
    const scopedDealerId = requireDealerId(dealerId);
    const dealer = await this.findMine(scopedDealerId);
    const normalizedEmail = this.normalizeEmail(dto.email);

    if (this.normalizeEmail(dealer.email) === normalizedEmail) {
      throw new BadRequestException(errorMessages.DEALER_EMAIL_UNCHANGED);
    }

    await this.assertEmailAvailableForDealer(normalizedEmail, scopedDealerId);

    const cooldownKey = this.otpCooldownKey(scopedDealerId, normalizedEmail);
    const cooldownActive = await this.redis.get(cooldownKey);
    if (cooldownActive) {
      throw new HttpException(
        errorMessages.DEALER_EMAIL_OTP_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const otpKey = this.otpKey(scopedDealerId, normalizedEmail);

    await this.redis.set(otpKey, otp, 'EX', DEALER_EMAIL_OTP_EXPIRY_SECONDS);
    await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      DEALER_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
    );
    await this.redis.del(this.otpVerifiedKey(scopedDealerId, normalizedEmail));

    const sent = await this.mailService.sendMail(
      normalizedEmail,
      emailSubject.DEALER_EMAIL_OTP,
      emailTemplate.DEALER_EMAIL_OTP,
      {
        otp,
        expiresInMinutes: DEALER_EMAIL_OTP_EXPIRY_SECONDS / 60,
      },
    );

    if (!sent) {
      await this.redis.del(otpKey, cooldownKey);
      throw new InternalServerErrorException(
        errorMessages.FAILED_TO_SEND_VERIFICATION_CODE,
      );
    }

    return { expiresInSeconds: DEALER_EMAIL_OTP_EXPIRY_SECONDS };
  }

  async verifyEmailOtp(
    dealerId: string | null | undefined,
    dto: VerifyDealerEmailOtpDto,
  ): Promise<{ verified: true }> {
    const scopedDealerId = requireDealerId(dealerId);
    const dealer = await this.findMine(scopedDealerId);
    const normalizedEmail = this.normalizeEmail(dto.email);

    if (this.normalizeEmail(dealer.email) === normalizedEmail) {
      throw new BadRequestException(errorMessages.DEALER_EMAIL_UNCHANGED);
    }

    await this.assertEmailAvailableForDealer(normalizedEmail, scopedDealerId);

    const otpKey = this.otpKey(scopedDealerId, normalizedEmail);
    const storedOtp = await this.redis.get(otpKey);

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException(errorMessages.DEALER_EMAIL_OTP_INVALID);
    }

    await this.redis.del(otpKey);
    await this.redis.set(
      this.otpVerifiedKey(scopedDealerId, normalizedEmail),
      '1',
      'EX',
      DEALER_EMAIL_OTP_VERIFIED_TTL_SECONDS,
    );

    return { verified: true };
  }

  async updateMine(
    dealerId: string | null | undefined,
    updateDealerDto: UpdateDealerDto,
  ): Promise<Dealer> {
    const scopedDealerId = requireDealerId(dealerId);
    const dealer = await this.findMine(scopedDealerId);

    const updatePayload = Object.fromEntries(
      Object.entries(updateDealerDto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updatePayload).length === 0) {
      return dealer;
    }

    if (updatePayload.email !== undefined) {
      const normalizedEmail = this.normalizeEmail(updatePayload.email);

      if (this.normalizeEmail(dealer.email) !== normalizedEmail) {
        const verified = await this.redis.get(
          this.otpVerifiedKey(scopedDealerId, normalizedEmail),
        );

        if (!verified) {
          throw new BadRequestException(errorMessages.DEALER_EMAIL_OTP_REQUIRED);
        }

        await this.assertEmailAvailableForDealer(normalizedEmail, scopedDealerId);
        updatePayload.email = normalizedEmail;
      } else {
        delete updatePayload.email;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return dealer;
    }

    await this.dealerRepository.update(scopedDealerId, updatePayload);

    if (updatePayload.email) {
      await this.redis.del(
        this.otpVerifiedKey(scopedDealerId, updatePayload.email as string),
      );
    }

    return this.findMine(scopedDealerId);
  }
}

import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class SendDealerEmailOtpDto {
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;
}

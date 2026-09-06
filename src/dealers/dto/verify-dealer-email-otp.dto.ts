import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyDealerEmailOtpDto {
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code' })
  otp: string;
}

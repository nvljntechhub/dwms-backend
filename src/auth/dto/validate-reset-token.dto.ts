import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateResetTokenDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}

import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please enter valid email!' })
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

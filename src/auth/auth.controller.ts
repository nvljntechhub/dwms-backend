import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { AuthService } from './auth.service';
import {
  emailSubject,
  emailTemplate,
  successMessages,
} from 'src/utils/properties.utils';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { SignInDto } from './dto/signin-dto';
import type { SignOptions } from 'jsonwebtoken';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  @Post('signIn')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse> {
    const { accessToken, refreshToken } =
      await this.authService.signIn(signInDto);
    return new ApiResponse(HttpStatus.OK, 'Logged In successfully', {
      accessToken,
      refreshToken,
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: CreateUserDto): Promise<ApiResponse> {
    const { user } = await this.authService.register(registerDto);

    const verifyLink = `${this.configService.get<string>('FRONTEND_URL')}/account-verify?token=1`;

    await this.mailService.sendMail(
      user.email,
      emailSubject.EMAIL_VERIFICATION,
      emailTemplate.EMAIL_VERIFICATION,
      {
        verificationLink: verifyLink,
      },
    );

    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.USER_REGISTERED_SUCCESSFULLY,
      user,
    );
  }

  async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
          expiresIn: this.configService.get<string>(
            'ACCESS_TOKEN_EXPIRED',
          ) as SignOptions['expiresIn'],
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
          expiresIn: this.configService.get<string>(
            'REFRESH_TOKEN_EXPIRED',
          ) as SignOptions['expiresIn'],
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}

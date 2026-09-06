import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiResponse } from "src/common/utils/responses/api-response";
import { RegisterDto } from "./dto/register.dto";
import { AuthService } from "./auth.service";
import {
  emailSubject,
  emailTemplate,
  errorMessages,
  successMessages,
} from "src/utils/properties.utils";
import { ConfigService } from "@nestjs/config";
import { MailService } from "src/mail/mail.service";
import { SignInDto } from "./dto/signin-dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ValidateResetTokenDto } from "./dto/validate-reset-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyPasswordDto } from "./dto/verify-password.dto";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthJwtPayload } from "./types/jwt-payload";
import { UserRole } from "src/common/utils/enums/user-role";
import {
  AUTH_COOKIE_NAMES,
  clearAuthCookies,
  setAuthCookies,
} from "./auth-cookie.utils";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse> {
    const { accessToken, refreshToken, user } =
      await this.authService.signIn(signInDto);
    setAuthCookies(response, this.configService, { accessToken, refreshToken });
    return new ApiResponse(HttpStatus.OK, "Logged In successfully", user);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse> {
    const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refreshToken];
    if (!refreshToken) {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    const { accessToken, refreshToken: nextRefreshToken } =
      await this.authService.refresh(refreshToken);
    setAuthCookies(response, this.configService, {
      accessToken,
      refreshToken: nextRefreshToken,
    });
    return new ApiResponse(HttpStatus.OK, successMessages.TOKENS_REFRESHED);
  }

  @Post("verify-password")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyPassword(
    @Body() verifyPasswordDto: VerifyPasswordDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const result = await this.authService.verifyPassword(
      currentUser.sub,
      verifyPasswordDto.password,
    );

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PASSWORD_VERIFIED,
      result,
    );
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse> {
    const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refreshToken];
    await this.authService.logout(refreshToken);
    clearAuthCookies(response, this.configService);
    return new ApiResponse(HttpStatus.OK, successMessages.LOGOUT_SUCCESSFUL);
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async registerDealer(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse> {
    const { accessToken, refreshToken, user } =
      await this.authService.registerDealer(registerDto);
    setAuthCookies(response, this.configService, { accessToken, refreshToken });
    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.DEALER_REGISTERED_SUCCESSFULLY,
      user,
    );
  }

  @Post("verifyEmail")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<ApiResponse> {
    const user = await this.authService.verifyEmail(verifyEmailDto.token);

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.EMAIL_VERIFIED_SUCCESSFULLY,
      user,
    );
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ApiResponse> {
    const user = await this.authService.findUserByEmail(
      forgotPasswordDto.email,
    );

    if (user) {
      const resetToken = await this.authService.generatePasswordResetToken(
        user.id,
        user.email,
      );

      const resetLink = `${this.configService.get<string>("FRONTEND_URL")}/login?type=password-reset&token=${resetToken}`;

      await this.mailService.sendMail(
        user.email,
        emailSubject.PASSWORD_RESET,
        emailTemplate.PASSWORD_RESET,
        {
          resetLink,
        },
      );
    }

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.FORGOT_PASSWORD_EMAIL_SENT,
    );
  }

  @Post("validate-reset-token")
  @HttpCode(HttpStatus.OK)
  async validateResetToken(
    @Body() validateResetTokenDto: ValidateResetTokenDto,
  ): Promise<ApiResponse> {
    await this.authService.validatePasswordResetToken(
      validateResetTokenDto.token,
    );

    return new ApiResponse(HttpStatus.OK, successMessages.RESET_TOKEN_VALID);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ApiResponse> {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PASSWORD_RESET_SUCCESSFUL,
    );
  }
}

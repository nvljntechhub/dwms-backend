import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DealersService } from './dealers.service';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { SendDealerEmailOtpDto } from './dto/send-dealer-email-otp.dto';
import { VerifyDealerEmailOtpDto } from './dto/verify-dealer-email-otp.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';

@Controller('dealers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealersController {
  constructor(private readonly dealersService: DealersService) {}

  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF, UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  async findMine(
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const dealer = await this.dealersService.findMine(currentUser.dealerId);
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.DEALER_FETCHED_SUCCESSFULLY,
      dealer,
    );
  }

  @Patch('me')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateMine(
    @Body() updateDealerDto: UpdateDealerDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const dealer = await this.dealersService.updateMine(
      currentUser.dealerId,
      updateDealerDto,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.DEALER_UPDATED_SUCCESSFULLY,
      dealer,
    );
  }

  @Post('me/email/send-otp')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async sendEmailOtp(
    @Body() sendDealerEmailOtpDto: SendDealerEmailOtpDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const result = await this.dealersService.sendEmailOtp(
      currentUser.dealerId,
      sendDealerEmailOtpDto,
    );

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.VERIFICATION_CODE_SENT,
      result,
    );
  }

  @Post('me/email/verify-otp')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(
    @Body() verifyDealerEmailOtpDto: VerifyDealerEmailOtpDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const result = await this.dealersService.verifyEmailOtp(
      currentUser.dealerId,
      verifyDealerEmailOtpDto,
    );

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.DEALER_EMAIL_VERIFIED,
      result,
    );
  }
}

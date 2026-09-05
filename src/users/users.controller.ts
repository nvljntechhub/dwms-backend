import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import {
  buildProfileImageUrl,
  extractProfileImageFilename,
  profileImageMulterOptions,
  removeProfileImage,
} from 'src/common/utils/multer-options.utils';
import { CleanupProfileImageInterceptor } from 'src/common/interceptors/cleanup-profile-image.interceptor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  private getAppUrl(): string {
    return (
      this.configService.get<string>('APP_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') || 5001}`
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageMulterOptions),
    CleanupProfileImageInterceptor,
  )
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: AuthJwtPayload,
    @UploadedFile() profileImage?: Express.Multer.File,
  ): Promise<ApiResponse> {
    if (profileImage) {
      createUserDto.profileURL = buildProfileImageUrl(
        profileImage.filename,
        this.getAppUrl(),
      );
    }

    const user = await this.usersService.create(
      createUserDto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.USER_CREATED_SUCCESSFULLY,
      user,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const users = await this.usersService.findAll(currentUser.dealerId);
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.USERS_FETCHED_SUCCESSFULLY,
      users,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const user = await this.usersService.findOne(id, currentUser.dealerId);
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.USER_FETCHED_SUCCESSFULLY,
      user,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageMulterOptions),
    CleanupProfileImageInterceptor,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthJwtPayload,
    @UploadedFile() profileImage?: Express.Multer.File,
  ): Promise<ApiResponse> {
    const existingUser = await this.usersService.findOne(
      id,
      currentUser.dealerId,
    );
    const previousFilename = extractProfileImageFilename(
      existingUser.profileURL,
    );

    if (profileImage) {
      updateUserDto.profileURL = buildProfileImageUrl(
        profileImage.filename,
        this.getAppUrl(),
      );
    }

    const user = await this.usersService.update(
      id,
      updateUserDto,
      currentUser.dealerId,
    );

    // Replace succeeded — remove the previous local image if it changed
    if (
      profileImage &&
      previousFilename &&
      previousFilename !== profileImage.filename
    ) {
      await removeProfileImage(previousFilename);
    }

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.USER_UPDATED_SUCCESSFULLY,
      user,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const existingUser = await this.usersService.findOne(
      id,
      currentUser.dealerId,
    );
    const profileFilename = extractProfileImageFilename(
      existingUser.profileURL,
    );

    await this.usersService.remove(id, currentUser.dealerId);

    if (profileFilename) {
      await removeProfileImage(profileFilename);
    }

    return new ApiResponse(
      HttpStatus.OK,
      successMessages.USER_DELETED_SUCCESSFULLY,
    );
  }
}

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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import { csvUploadMulterOptions } from 'src/common/utils/multer-options.utils';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';
import { ProductsQueryDto } from './dto/products-query.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', csvUploadMulterOptions))
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser: AuthJwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ApiResponse> {
    if (file) {
      const products = await this.productsService.createBulkFromCsv(
        file,
        currentUser.dealerId,
      );
      return new ApiResponse(
        HttpStatus.CREATED,
        successMessages.PRODUCTS_CREATED_SUCCESSFULLY,
        products,
      );
    }

    const product = await this.productsService.createFromBody(
      body,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.PRODUCT_CREATED_SUCCESSFULLY,
      product,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: ProductsQueryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const products = await this.productsService.findAll(
      currentUser.dealerId,
      query,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PRODUCTS_FETCHED_SUCCESSFULLY,
      products,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const product = await this.productsService.findOne(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PRODUCT_FETCHED_SUCCESSFULLY,
      product,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const product = await this.productsService.update(
      id,
      dto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PRODUCT_UPDATED_SUCCESSFULLY,
      product,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    await this.productsService.remove(id, currentUser.dealerId);
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PRODUCT_DELETED_SUCCESSFULLY,
    );
  }
}

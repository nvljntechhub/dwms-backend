import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { GetAvailableStockQueryDto } from './dto/get-available-stock.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const inventory = await this.inventoryService.findAll(
      currentUser.dealerId,
      query,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.INVENTORY_FETCHED_SUCCESSFULLY,
      inventory,
    );
  }

  @Get('available')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async available(
    @Query() query: GetAvailableStockQueryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const stock = await this.inventoryService.getAvailableByProducts(
      query.productIds,
      query.warehouseId,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.AVAILABLE_STOCK_FETCHED_SUCCESSFULLY,
      stock,
    );
  }

  @Get('dashboard')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STAFF,
    UserRole.DRIVER,
  )
  @HttpCode(HttpStatus.OK)
  async dashboard(
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const stats = await this.inventoryService.getDashboardStats(
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.DASHBOARD_STATS_FETCHED_SUCCESSFULLY,
      stats,
    );
  }

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async movements(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const movements = await this.inventoryService.getMovements(
      currentUser.dealerId,
      query,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.STOCK_MOVEMENTS_FETCHED_SUCCESSFULLY,
      movements,
    );
  }

  @Post('adjust')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async adjust(
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const inventory = await this.inventoryService.adjust(
      dto,
      currentUser.dealerId,
      currentUser.sub,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.INVENTORY_ADJUSTED_SUCCESSFULLY,
      inventory,
    );
  }
}

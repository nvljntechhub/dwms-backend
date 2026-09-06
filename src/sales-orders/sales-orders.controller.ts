import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';
import {
  ApproveSalesOrderDto,
  CreateSalesOrderDto,
} from './dto/create-sales-order.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('sales-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.create(
      dto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.SALES_ORDER_CREATED_SUCCESSFULLY,
      so,
    );
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STAFF,
    UserRole.DRIVER,
  )
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const orders = await this.salesOrdersService.findAll(
      currentUser.dealerId,
      query,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDERS_FETCHED_SUCCESSFULLY,
      orders,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STAFF,
    UserRole.DRIVER,
  )
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.findOne(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_FETCHED_SUCCESSFULLY,
      so,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.update(
      id,
      dto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_UPDATED_SUCCESSFULLY,
      so,
    );
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveSalesOrderDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.approve(
      id,
      currentUser.dealerId,
      currentUser.role,
      dto,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_APPROVED_SUCCESSFULLY,
      so,
    );
  }

  @Patch(':id/pick')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async pick(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.startPicking(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_PICKING_STARTED,
      so,
    );
  }

  @Patch(':id/ship')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async ship(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.ship(id, currentUser.dealerId);
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_SHIPPED_SUCCESSFULLY,
      so,
    );
  }

  @Patch(':id/deliver')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  async deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.deliver(
      id,
      currentUser.dealerId,
      currentUser.sub,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_DELIVERED_SUCCESSFULLY,
      so,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const so = await this.salesOrdersService.cancel(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.SALES_ORDER_CANCELLED_SUCCESSFULLY,
      so,
    );
  }
}

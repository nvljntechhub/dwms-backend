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
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveGrnDto } from './dto/receive-grn.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const po = await this.purchaseOrdersService.create(
      dto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.PURCHASE_ORDER_CREATED_SUCCESSFULLY,
      po,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const orders = await this.purchaseOrdersService.findAll(
      currentUser.dealerId,
      query,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PURCHASE_ORDERS_FETCHED_SUCCESSFULLY,
      orders,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const po = await this.purchaseOrdersService.findOne(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PURCHASE_ORDER_FETCHED_SUCCESSFULLY,
      po,
    );
  }

  @Patch(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const po = await this.purchaseOrdersService.submitOrder(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PURCHASE_ORDER_SUBMITTED_SUCCESSFULLY,
      po,
    );
  }

  @Post(':id/grn')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  async receiveGrn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveGrnDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const po = await this.purchaseOrdersService.receiveGrn(
      id,
      dto,
      currentUser.dealerId,
      currentUser.sub,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.GRN_RECEIVED_SUCCESSFULLY,
      po,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const po = await this.purchaseOrdersService.cancel(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.PURCHASE_ORDER_CANCELLED_SUCCESSFULLY,
      po,
    );
  }
}

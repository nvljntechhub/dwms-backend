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
  UseGuards,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { ApiResponse } from 'src/common/utils/responses/api-response';
import { successMessages } from 'src/utils/properties.utils';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthJwtPayload } from 'src/auth/types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createWarehouseDto: CreateWarehouseDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const warehouse = await this.warehousesService.create(
      createWarehouseDto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.CREATED,
      successMessages.WAREHOUSE_CREATED_SUCCESSFULLY,
      warehouse,
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
    const warehouses = await this.warehousesService.findAll(
      currentUser.dealerId,
      query,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.WAREHOUSES_FETCHED_SUCCESSFULLY,
      warehouses,
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
    const warehouse = await this.warehousesService.findOne(
      id,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.WAREHOUSE_FETCHED_SUCCESSFULLY,
      warehouse,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    const warehouse = await this.warehousesService.update(
      id,
      updateWarehouseDto,
      currentUser.dealerId,
    );
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.WAREHOUSE_UPDATED_SUCCESSFULLY,
      warehouse,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthJwtPayload,
  ): Promise<ApiResponse> {
    await this.warehousesService.remove(id, currentUser.dealerId);
    return new ApiResponse(
      HttpStatus.OK,
      successMessages.WAREHOUSE_DELETED_SUCCESSFULLY,
    );
  }
}

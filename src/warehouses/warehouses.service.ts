import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { errorMessages } from 'src/utils/properties.utils';
import {
  assertTenantMatch,
  requireDealerId,
} from 'src/common/utils/tenant-scope.utils';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  applySearchTerm,
  buildPaginatedResult,
  normalizePagination,
  PaginatedResult,
} from 'src/common/utils/pagination.utils';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  async create(
    createWarehouseDto: CreateWarehouseDto,
    dealerId?: string | null,
  ): Promise<Warehouse> {
    const scopedDealerId = requireDealerId(dealerId);

    if (createWarehouseDto.isDefault) {
      await this.warehouseRepository.update(
        { dealer: { id: scopedDealerId } },
        { isDefault: false },
      );
    }

    const warehouse = this.warehouseRepository.create({
      ...createWarehouseDto,
      dealer: { id: scopedDealerId } as Dealer,
    });

    return this.warehouseRepository.save(warehouse);
  }

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<Warehouse>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.warehouseRepository
      .createQueryBuilder('warehouse')
      .where('warehouse.dealer_id = :dealerId', { dealerId: scopedDealerId })
      .orderBy('warehouse.name', 'ASC');

    applySearchTerm(qb, [
      'warehouse.name',
      'warehouse.street',
      'warehouse.city',
      'warehouse.state',
      'warehouse.postalCode',
      'warehouse.country',
    ], searchTerm);

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return buildPaginatedResult(items, total, page, limit);
  }

  async findOne(id: string, dealerId?: string | null): Promise<Warehouse> {
    const scopedDealerId = requireDealerId(dealerId);
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
      relations: ['dealer'],
    });

    if (!warehouse) {
      throw new NotFoundException(errorMessages.WAREHOUSE_NOT_FOUND);
    }

    assertTenantMatch(warehouse.dealerId, scopedDealerId);
    return warehouse;
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto,
    dealerId?: string | null,
  ): Promise<Warehouse> {
    const scopedDealerId = requireDealerId(dealerId);
    const warehouse = await this.findOne(id, scopedDealerId);

    if (updateWarehouseDto.isDefault) {
      await this.warehouseRepository.update(
        { dealer: { id: scopedDealerId } },
        { isDefault: false },
      );
    }

    const updatePayload = Object.fromEntries(
      Object.entries(updateWarehouseDto).filter(
        ([, value]) => value !== undefined,
      ),
    );

    if (Object.keys(updatePayload).length > 0) {
      await this.warehouseRepository.update(id, updatePayload);
    }

    return this.findOne(id, scopedDealerId);
  }

  async remove(id: string, dealerId?: string | null): Promise<void> {
    const scopedDealerId = requireDealerId(dealerId);
    const warehouse = await this.findOne(id, scopedDealerId);

    if (warehouse.isDefault) {
      throw new BadRequestException(errorMessages.CANNOT_DELETE_DEFAULT_WAREHOUSE);
    }

    await this.warehouseRepository.delete(id);
  }
}

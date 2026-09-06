import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Manufacturer } from './entities/manufacturer.entity';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto';
import { UpdateManufacturerDto } from './dto/update-manufacturer.dto';
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
export class ManufacturersService {
  constructor(
    @InjectRepository(Manufacturer)
    private readonly manufacturerRepository: Repository<Manufacturer>,
  ) {}

  async create(
    dto: CreateManufacturerDto,
    dealerId?: string | null,
  ): Promise<Manufacturer> {
    const scopedDealerId = requireDealerId(dealerId);
    const manufacturer = this.manufacturerRepository.create({
      ...dto,
      dealer: { id: scopedDealerId } as Dealer,
    });
    return this.manufacturerRepository.save(manufacturer);
  }

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<Manufacturer>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.manufacturerRepository
      .createQueryBuilder('manufacturer')
      .where('manufacturer.dealer_id = :dealerId', { dealerId: scopedDealerId })
      .orderBy('manufacturer.name', 'ASC');

    applySearchTerm(qb, [
      'manufacturer.name',
      'manufacturer.contactName',
      'manufacturer.email',
      'manufacturer.phone',
    ], searchTerm);

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return buildPaginatedResult(items, total, page, limit);
  }

  async findOne(id: string, dealerId?: string | null): Promise<Manufacturer> {
    const scopedDealerId = requireDealerId(dealerId);
    const manufacturer = await this.manufacturerRepository.findOne({
      where: { id },
    });

    if (!manufacturer) {
      throw new NotFoundException(errorMessages.MANUFACTURER_NOT_FOUND);
    }

    assertTenantMatch(manufacturer.dealerId, scopedDealerId);
    return manufacturer;
  }

  async update(
    id: string,
    dto: UpdateManufacturerDto,
    dealerId?: string | null,
  ): Promise<Manufacturer> {
    await this.findOne(id, dealerId);
    const updatePayload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updatePayload).length > 0) {
      await this.manufacturerRepository.update(id, updatePayload);
    }

    return this.findOne(id, dealerId);
  }

  async remove(id: string, dealerId?: string | null): Promise<void> {
    await this.findOne(id, dealerId);
    await this.manufacturerRepository.delete(id);
  }
}

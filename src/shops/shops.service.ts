import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { DealersService } from 'src/dealers/dealers.service';
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
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    private readonly dealersService: DealersService,
  ) {}

  async create(dto: CreateShopDto, dealerId?: string | null): Promise<Shop> {
    const scopedDealerId = requireDealerId(dealerId);
    const currency = await this.dealersService.getCurrency(scopedDealerId);
    const shop = this.shopRepository.create({
      ...dto,
      currency,
      dealer: { id: scopedDealerId } as Dealer,
    });
    return this.shopRepository.save(shop);
  }

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<Shop>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.shopRepository
      .createQueryBuilder('shop')
      .where('shop.dealer_id = :dealerId', { dealerId: scopedDealerId })
      .orderBy('shop.name', 'ASC');

    applySearchTerm(qb, [
      'shop.name',
      'shop.contactName',
      'shop.email',
      'shop.phone',
      'shop.shippingAddress',
      'shop.billingAddress',
    ], searchTerm);

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return buildPaginatedResult(items, total, page, limit);
  }

  async findOne(id: string, dealerId?: string | null): Promise<Shop> {
    const scopedDealerId = requireDealerId(dealerId);
    const shop = await this.shopRepository.findOne({ where: { id } });

    if (!shop) {
      throw new NotFoundException(errorMessages.SHOP_NOT_FOUND);
    }

    assertTenantMatch(shop.dealerId, scopedDealerId);
    return shop;
  }

  async update(
    id: string,
    dto: UpdateShopDto,
    dealerId?: string | null,
  ): Promise<Shop> {
    await this.findOne(id, dealerId);
    const updatePayload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updatePayload).length > 0) {
      await this.shopRepository.update(id, updatePayload);
    }

    return this.findOne(id, dealerId);
  }

  async remove(id: string, dealerId?: string | null): Promise<void> {
    await this.findOne(id, dealerId);
    await this.shopRepository.delete(id);
  }

  checkCreditLimit(shop: Shop, orderTotal: number): boolean {
    const balance = Number(shop.currentBalance);
    const limit = Number(shop.creditLimit);
    return balance + orderTotal <= limit;
  }
}

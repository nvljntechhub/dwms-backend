import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import {
  ApproveSalesOrderDto,
  CreateSalesOrderDto,
} from './dto/create-sales-order.dto';
import { SalesOrderStatus } from 'src/common/utils/enums/sales-order.enum';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { DealersService } from 'src/dealers/dealers.service';
import { Shop } from 'src/shops/entities/shop.entity';
import { errorMessages } from 'src/utils/properties.utils';
import {
  assertTenantMatch,
  requireDealerId,
} from 'src/common/utils/tenant-scope.utils';
import { InventoryService } from 'src/inventory/inventory.service';
import { ProductsService } from 'src/products/products.service';
import { ShopsService } from 'src/shops/shops.service';
import { WarehousesService } from 'src/warehouses/warehouses.service';
import { lockEntityById } from 'src/common/utils/pessimistic-lock.utils';
import { UserRole } from 'src/common/utils/enums/user-role';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  applySearchTerm,
  buildPaginatedResult,
  normalizePagination,
  orderItemsByIds,
  PaginatedResult,
} from 'src/common/utils/pagination.utils';
import {
  SalesOrderDetailView,
  SalesOrderListView,
  toSalesOrderDetail,
  toSalesOrderListItem,
} from './utils/map-sales-order';

@Injectable()
export class SalesOrdersService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepository: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private readonly salesOrderItemRepository: Repository<SalesOrderItem>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    private readonly inventoryService: InventoryService,
    private readonly shopsService: ShopsService,
    private readonly warehousesService: WarehousesService,
    private readonly productsService: ProductsService,
    private readonly dealersService: DealersService,
    private readonly dataSource: DataSource,
  ) {}

  private async assertOrderRefs(
    dto: CreateSalesOrderDto,
    dealerId: string,
  ): Promise<void> {
    await Promise.all([
      this.shopsService.findOne(dto.shopId, dealerId),
      this.warehousesService.findOne(dto.warehouseId, dealerId),
      this.productsService.assertOwned(
        dto.items.map((item) => item.productId),
        dealerId,
      ),
    ]);
  }

  private async lockAndLoad(
    manager: EntityManager,
    id: string,
    dealerId: string,
    relations: string[],
  ): Promise<SalesOrder> {
    const locked = await lockEntityById(manager, SalesOrder, id);
    if (!locked) {
      throw new NotFoundException(errorMessages.SALES_ORDER_NOT_FOUND);
    }
    assertTenantMatch(locked.dealerId, dealerId);

    const so = await manager.findOne(SalesOrder, { where: { id }, relations });
    if (!so) {
      throw new NotFoundException(errorMessages.SALES_ORDER_NOT_FOUND);
    }

    return so;
  }

  async create(
    dto: CreateSalesOrderDto,
    dealerId?: string | null,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);
    await this.assertOrderRefs(dto, scopedDealerId);
    const currency = await this.dealersService.getCurrency(scopedDealerId);

    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const salesOrder = this.salesOrderRepository.create({
      status: SalesOrderStatus.PENDING,
      totalAmount,
      currency,
      dealer: { id: scopedDealerId } as Dealer,
      shop: { id: dto.shopId },
      warehouse: { id: dto.warehouseId },
      items: dto.items.map((item) =>
        this.salesOrderItemRepository.create({
          product: { id: item.productId },
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityShipped: 0,
        }),
      ),
    });

    const saved = await this.salesOrderRepository.save(salesOrder);
    return this.findOne(saved.id, scopedDealerId);
  }

  async update(
    id: string,
    dto: CreateSalesOrderDto,
    dealerId?: string | null,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      await this.assertOrderRefs(dto, scopedDealerId);
      const so = await this.lockAndLoad(manager, id, scopedDealerId, ['items']);

      if (so.status !== SalesOrderStatus.PENDING) {
        throw new BadRequestException(errorMessages.SALES_ORDER_NOT_EDITABLE);
      }

      const totalAmount = dto.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      if (so.items?.length) {
        await manager.remove(so.items);
      }

      so.shop = { id: dto.shopId } as Shop;
      so.warehouse = { id: dto.warehouseId } as SalesOrder['warehouse'];
      so.totalAmount = totalAmount;
      so.items = dto.items.map((item) =>
        manager.create(SalesOrderItem, {
          product: { id: item.productId },
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityShipped: 0,
        }),
      );

      await manager.save(so);

      const updated = await manager.findOne(SalesOrder, {
        where: { id },
        relations: ['shop', 'warehouse', 'items', 'items.product'],
      });

      return this.toDetail(updated as SalesOrder, scopedDealerId, manager);
    });
  }

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<SalesOrderListView>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.salesOrderRepository
      .createQueryBuilder('so')
      .where('so.dealer_id = :dealerId', { dealerId: scopedDealerId });

    if (searchTerm) {
      qb.leftJoin('so.shop', 'shop')
        .leftJoin('so.warehouse', 'warehouse')
        .leftJoin('so.items', 'items')
        .leftJoin('items.product', 'product');
      applySearchTerm(
        qb,
        [
          'so.id',
          'CAST(so.status AS text)',
          'CAST(so.totalAmount AS text)',
          'shop.name',
          'warehouse.name',
          'product.sku',
          'product.name',
        ],
        searchTerm,
      );
    }

    const total = await qb.clone().distinct(true).getCount();
    const idRows = await qb
      .clone()
      .select('so.id', 'id')
      .addSelect('so.createdAt')
      .distinct(true)
      .orderBy('so.createdAt', 'DESC')
      .offset(skip)
      .limit(limit)
      .getRawMany<{ id: string }>();

    if (!idRows.length) {
      return buildPaginatedResult([], total, page, limit);
    }

    const ids = idRows.map((row) => row.id);
    const items = await this.salesOrderRepository.find({
      where: { id: In(ids) },
      relations: ['shop', 'warehouse', 'items'],
    });

    return buildPaginatedResult(
      orderItemsByIds(items, ids).map(toSalesOrderListItem),
      total,
      page,
      limit,
    );
  }

  private async loadOne(
    id: string,
    dealerId?: string | null,
  ): Promise<SalesOrder> {
    const scopedDealerId = requireDealerId(dealerId);
    const so = await this.salesOrderRepository.findOne({
      where: { id },
      relations: ['shop', 'warehouse', 'items', 'items.product'],
    });

    if (!so) {
      throw new NotFoundException(errorMessages.SALES_ORDER_NOT_FOUND);
    }

    assertTenantMatch(so.dealerId, scopedDealerId);
    return so;
  }

  private async toDetail(
    so: SalesOrder,
    dealerId: string,
    manager?: EntityManager,
  ): Promise<SalesOrderDetailView> {
    const productIds = [
      ...new Set(
        (so.items ?? [])
          .map((item) => item.product?.id ?? item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const stockByProductId = await this.inventoryService.getOnHandByProducts(
      productIds,
      so.warehouseId,
      dealerId,
      manager,
    );

    return toSalesOrderDetail(so, stockByProductId);
  }

  async findOne(
    id: string,
    dealerId?: string | null,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);
    return this.toDetail(await this.loadOne(id, scopedDealerId), scopedDealerId);
  }

  async approve(
    id: string,
    dealerId: string | null | undefined,
    userRole: UserRole | null,
    dto: ApproveSalesOrderDto = {},
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const so = await this.lockAndLoad(manager, id, scopedDealerId, [
        'shop',
        'items',
      ]);

      if (so.status !== SalesOrderStatus.PENDING) {
        throw new BadRequestException(errorMessages.INVALID_SO_STATUS_TRANSITION);
      }

      const shop = await this.shopsService.findOne(so.shopId, scopedDealerId);
      const orderTotal = Number(so.totalAmount);

      if (
        !this.shopsService.checkCreditLimit(shop, orderTotal) &&
        !dto.overrideCreditLimit
      ) {
        throw new BadRequestException(errorMessages.CREDIT_LIMIT_EXCEEDED);
      }

      if (dto.overrideCreditLimit && userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(errorMessages.PERMISSION_DENIED);
      }

      for (const item of so.items) {
        await this.inventoryService.allocateStock(
          manager,
          item.productId,
          so.warehouseId,
          scopedDealerId,
          item.quantity,
        );
      }

      await manager.update(SalesOrder, id, {
        status: SalesOrderStatus.APPROVED,
      });

      const updated = await manager.findOne(SalesOrder, {
        where: { id },
        relations: ['shop', 'warehouse', 'items', 'items.product'],
      });

      return this.toDetail(updated as SalesOrder, scopedDealerId, manager);
    });
  }

  async startPicking(
    id: string,
    dealerId?: string | null,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const so = await this.lockAndLoad(manager, id, scopedDealerId, [
        'shop',
        'warehouse',
        'items',
        'items.product',
      ]);

      if (so.status !== SalesOrderStatus.APPROVED) {
        throw new BadRequestException(errorMessages.INVALID_SO_STATUS_TRANSITION);
      }

      so.status = SalesOrderStatus.PICKING;
      await manager.save(so);
      return this.toDetail(so, scopedDealerId, manager);
    });
  }

  async ship(
    id: string,
    dealerId?: string | null,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const so = await this.lockAndLoad(manager, id, scopedDealerId, [
        'shop',
        'warehouse',
        'items',
        'items.product',
      ]);

      if (so.status !== SalesOrderStatus.PICKING) {
        throw new BadRequestException(errorMessages.INVALID_SO_STATUS_TRANSITION);
      }

      so.status = SalesOrderStatus.SHIPPED;
      await manager.save(so);
      return this.toDetail(so, scopedDealerId, manager);
    });
  }

  async deliver(
    id: string,
    dealerId?: string | null,
    userId?: string,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const so = await this.lockAndLoad(manager, id, scopedDealerId, [
        'shop',
        'items',
      ]);

      if (
        so.status !== SalesOrderStatus.SHIPPED &&
        so.status !== SalesOrderStatus.PICKING
      ) {
        throw new BadRequestException(errorMessages.INVALID_SO_STATUS_TRANSITION);
      }

      for (const item of so.items) {
        await this.inventoryService.dispatchStock(
          manager,
          item.productId,
          so.warehouseId,
          scopedDealerId,
          item.quantity,
          so.id,
          userId,
        );
        item.quantityShipped = item.quantity;
        await manager.save(item);
      }

      const shop = await manager.findOne(Shop, { where: { id: so.shopId } });
      if (shop) {
        shop.currentBalance =
          Number(shop.currentBalance) + Number(so.totalAmount);
        await manager.save(shop);
      }

      await manager.update(SalesOrder, id, {
        status: SalesOrderStatus.DELIVERED,
      });

      const updated = await manager.findOne(SalesOrder, {
        where: { id },
        relations: ['shop', 'warehouse', 'items', 'items.product'],
      });

      return this.toDetail(updated as SalesOrder, scopedDealerId, manager);
    });
  }

  async cancel(
    id: string,
    dealerId?: string | null,
  ): Promise<SalesOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const so = await this.lockAndLoad(manager, id, scopedDealerId, ['items']);

      if (
        so.status === SalesOrderStatus.DELIVERED ||
        so.status === SalesOrderStatus.CANCELLED ||
        so.status === SalesOrderStatus.SHIPPED
      ) {
        throw new BadRequestException(errorMessages.INVALID_SO_STATUS_TRANSITION);
      }

      if (
        so.status === SalesOrderStatus.APPROVED ||
        so.status === SalesOrderStatus.PICKING
      ) {
        for (const item of so.items) {
          await this.inventoryService.releaseAllocation(
            manager,
            item.productId,
            so.warehouseId,
            scopedDealerId,
            item.quantity,
          );
        }
      }

      await manager.update(SalesOrder, id, {
        status: SalesOrderStatus.CANCELLED,
      });

      const updated = await manager.findOne(SalesOrder, {
        where: { id },
        relations: ['shop', 'warehouse', 'items', 'items.product'],
      });

      return this.toDetail(updated as SalesOrder, scopedDealerId, manager);
    });
  }
}

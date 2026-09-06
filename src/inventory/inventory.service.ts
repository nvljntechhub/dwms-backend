import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockMovementType } from 'src/common/utils/enums/stock-movement.enum';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { User } from 'src/users/entities/user.entity';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { errorMessages } from 'src/utils/properties.utils';
import {
  assertTenantMatch,
  requireDealerId,
} from 'src/common/utils/tenant-scope.utils';
import { PurchaseOrderStatus } from 'src/common/utils/enums/purchase-order.enum';
import { SalesOrderStatus } from 'src/common/utils/enums/sales-order.enum';
import { PurchaseOrder } from 'src/purchase-orders/entities/purchase-order.entity';
import { SalesOrder } from 'src/sales-orders/entities/sales-order.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  applySearchTerm,
  buildPaginatedResult,
  normalizePagination,
  PaginatedResult,
} from 'src/common/utils/pagination.utils';

export interface StockMovementContext {
  movementType: StockMovementType;
  quantityDelta: number;
  referenceType?: string;
  referenceId?: string;
  userId?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepository: Repository<SalesOrder>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<Inventory & { availableQuantity: number }>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.product', 'product')
      .leftJoinAndSelect('inventory.warehouse', 'warehouse')
      .where('inventory.dealer_id = :dealerId', { dealerId: scopedDealerId })
      .orderBy('inventory.updatedAt', 'DESC');

    applySearchTerm(
      qb,
      [
        'product.sku',
        'product.name',
        'product.barcode',
        'warehouse.name',
        'warehouse.city',
      ],
      searchTerm,
    );

    const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();
    const items = rows.map((row) => ({
      ...row,
      availableQuantity: row.quantityOnHand - row.quantityAllocated,
    }));

    return buildPaginatedResult(items, total, page, limit);
  }

  async adjust(
    dto: AdjustInventoryDto,
    dealerId: string | null | undefined,
    userId?: string,
  ): Promise<Inventory> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const inventory = await this.getOrCreateLocked(
        manager,
        dto.productId,
        dto.warehouseId,
        scopedDealerId,
      );

      const newOnHand = inventory.quantityOnHand + dto.quantityDelta;
      if (newOnHand < 0) {
        throw new BadRequestException(errorMessages.INSUFFICIENT_STOCK);
      }
      if (newOnHand < inventory.quantityAllocated) {
        throw new BadRequestException(errorMessages.ADJUSTMENT_BELOW_ALLOCATED);
      }

      inventory.quantityOnHand = newOnHand;
      await manager.save(inventory);

      await this.recordMovement(manager, {
        dealerId: scopedDealerId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        movementType: StockMovementType.ADJUSTMENT,
        quantityDelta: dto.quantityDelta,
        userId,
      });

      return inventory;
    });
  }

  async receiveStock(
    manager: EntityManager,
    productId: string,
    warehouseId: string,
    dealerId: string,
    quantity: number,
    referenceId: string,
    userId?: string,
  ): Promise<void> {
    const inventory = await this.getOrCreateLocked(
      manager,
      productId,
      warehouseId,
      dealerId,
    );
    inventory.quantityOnHand += quantity;
    await manager.save(inventory);

    await this.recordMovement(manager, {
      dealerId,
      productId,
      warehouseId,
      movementType: StockMovementType.PO_RECEIPT,
      quantityDelta: quantity,
      referenceType: 'purchase_order',
      referenceId,
      userId,
    });
  }

  async allocateStock(
    manager: EntityManager,
    productId: string,
    warehouseId: string,
    dealerId: string,
    quantity: number,
  ): Promise<void> {
    const inventory = await this.getOrCreateLocked(
      manager,
      productId,
      warehouseId,
      dealerId,
    );

    const available = inventory.quantityOnHand - inventory.quantityAllocated;
    if (available < quantity) {
      throw new BadRequestException(errorMessages.INSUFFICIENT_STOCK);
    }

    inventory.quantityAllocated += quantity;
    await manager.save(inventory);
  }

  async releaseAllocation(
    manager: EntityManager,
    productId: string,
    warehouseId: string,
    dealerId: string,
    quantity: number,
  ): Promise<void> {
    const inventory = await this.getOrCreateLocked(
      manager,
      productId,
      warehouseId,
      dealerId,
    );

    inventory.quantityAllocated = Math.max(
      0,
      inventory.quantityAllocated - quantity,
    );
    await manager.save(inventory);
  }

  async dispatchStock(
    manager: EntityManager,
    productId: string,
    warehouseId: string,
    dealerId: string,
    quantity: number,
    referenceId: string,
    userId?: string,
  ): Promise<void> {
    const inventory = await this.getOrCreateLocked(
      manager,
      productId,
      warehouseId,
      dealerId,
    );

    if (inventory.quantityOnHand < quantity) {
      throw new BadRequestException(errorMessages.INSUFFICIENT_STOCK);
    }

    inventory.quantityOnHand -= quantity;
    inventory.quantityAllocated = Math.max(
      0,
      inventory.quantityAllocated - quantity,
    );
    await manager.save(inventory);

    await this.recordMovement(manager, {
      dealerId,
      productId,
      warehouseId,
      movementType: StockMovementType.SO_DISPATCH,
      quantityDelta: -quantity,
      referenceType: 'sales_order',
      referenceId,
      userId,
    });
  }

  async getOnHandByProducts(
    productIds: string[],
    warehouseId: string,
    dealerId: string,
    manager?: EntityManager,
  ): Promise<
    Map<
      string,
      {
        quantityOnHand: number;
        quantityAllocated: number;
        availableQuantity: number;
      }
    >
  > {
    if (!productIds.length) {
      return new Map();
    }

    const inventoryRepository =
      manager?.getRepository(Inventory) ?? this.inventoryRepository;
    const rows = await inventoryRepository.find({
      where: {
        dealer: { id: dealerId },
        warehouse: { id: warehouseId },
        product: { id: In(productIds) },
      },
    });

    return new Map(
      rows.map((row) => [
        row.productId,
        {
          quantityOnHand: row.quantityOnHand,
          quantityAllocated: row.quantityAllocated,
          availableQuantity: row.quantityOnHand - row.quantityAllocated,
        },
      ]),
    );
  }

  async getAvailableByProducts(
    productIds: string[],
    warehouseId: string,
    dealerId?: string | null,
  ): Promise<{
    warehouseId: string;
    items: {
      productId: string;
      quantityOnHand: number;
      quantityAllocated: number;
      availableQuantity: number;
    }[];
  }> {
    const scopedDealerId = requireDealerId(dealerId);
    const uniqueIds = [...new Set(productIds)];

    const rows = uniqueIds.length
      ? await this.inventoryRepository.find({
          where: {
            dealer: { id: scopedDealerId },
            warehouse: { id: warehouseId },
            product: { id: In(uniqueIds) },
          },
        })
      : [];

    const byProductId = new Map(
      rows.map((row) => [
        row.productId,
        {
          productId: row.productId,
          quantityOnHand: row.quantityOnHand,
          quantityAllocated: row.quantityAllocated,
          availableQuantity: row.quantityOnHand - row.quantityAllocated,
        },
      ]),
    );

    return {
      warehouseId,
      items: uniqueIds.map(
        (productId) =>
          byProductId.get(productId) ?? {
            productId,
            quantityOnHand: 0,
            quantityAllocated: 0,
            availableQuantity: 0,
          },
      ),
    };
  }

  async getDashboardStats(dealerId?: string | null): Promise<{
    activeSkus: number;
    openPurchaseOrders: number;
    openSalesOrders: number;
    warehouseCount: number;
    lowStockCount: number;
  }> {
    const scopedDealerId = requireDealerId(dealerId);

    const [activeSkus, openPurchaseOrders, openSalesOrders, warehouseCount, inventoryRows] =
      await Promise.all([
        this.productRepository.count({
          where: { dealer: { id: scopedDealerId } },
        }),
        this.purchaseOrderRepository.count({
          where: {
            dealer: { id: scopedDealerId },
            status: PurchaseOrderStatus.ORDERED,
          },
        }),
        this.salesOrderRepository.count({
          where: {
            dealer: { id: scopedDealerId },
            status: SalesOrderStatus.APPROVED,
          },
        }),
        this.warehouseRepository.count({
          where: { dealer: { id: scopedDealerId } },
        }),
        this.inventoryRepository.find({
          where: { dealer: { id: scopedDealerId } },
          relations: ['product'],
        }),
      ]);
    const lowStockCount = inventoryRows.filter((row) => {
      const available = row.quantityOnHand - row.quantityAllocated;
      return (
        row.product?.reorderLevel > 0 && available <= row.product.reorderLevel
      );
    }).length;

    return {
      activeSkus,
      openPurchaseOrders,
      openSalesOrders,
      warehouseCount,
      lowStockCount,
    };
  }

  async getMovements(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<StockMovement>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.stockMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .leftJoinAndSelect('movement.warehouse', 'warehouse')
      .leftJoinAndSelect('movement.user', 'user')
      .where('movement.dealer_id = :dealerId', { dealerId: scopedDealerId })
      .orderBy('movement.createdAt', 'DESC');

    applySearchTerm(
      qb,
      [
        'CAST(movement.movementType AS text)',
        'movement.referenceType',
        'movement.referenceId',
        'product.sku',
        'product.name',
        'warehouse.name',
        'user.firstName',
        'user.lastName',
        'user.email',
      ],
      searchTerm,
    );

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return buildPaginatedResult(items, total, page, limit);
  }

  private async assertOwnedStockRefs(
    manager: EntityManager,
    productId: string,
    warehouseId: string,
    dealerId: string,
  ): Promise<void> {
    const product = await manager.findOne(Product, { where: { id: productId } });
    if (!product || product.dealerId !== dealerId) {
      throw new NotFoundException(errorMessages.PRODUCT_NOT_FOUND);
    }

    const warehouse = await manager.findOne(Warehouse, {
      where: { id: warehouseId },
    });
    if (!warehouse || warehouse.dealerId !== dealerId) {
      throw new NotFoundException(errorMessages.WAREHOUSE_NOT_FOUND);
    }
  }

  private async getOrCreateLocked(
    manager: EntityManager,
    productId: string,
    warehouseId: string,
    dealerId: string,
  ): Promise<Inventory> {
    await this.assertOwnedStockRefs(manager, productId, warehouseId, dealerId);

    let inventory = await manager
      .getRepository(Inventory)
      .createQueryBuilder('inventory')
      .setLock('pessimistic_write')
      .where('inventory.product_id = :productId', { productId })
      .andWhere('inventory.warehouse_id = :warehouseId', { warehouseId })
      .getOne();

    if (!inventory) {
      inventory = manager.create(Inventory, {
        product: { id: productId } as Product,
        warehouse: { id: warehouseId } as Warehouse,
        dealer: { id: dealerId } as Dealer,
        quantityOnHand: 0,
        quantityAllocated: 0,
      });
      inventory = await manager.save(inventory);

      inventory = await manager
        .getRepository(Inventory)
        .createQueryBuilder('inventory')
        .setLock('pessimistic_write')
        .where('inventory.id = :id', { id: inventory.id })
        .getOne();
    }

    if (!inventory) {
      throw new NotFoundException(errorMessages.INVENTORY_NOT_FOUND);
    }

    assertTenantMatch(inventory.dealerId, dealerId);
    return inventory;
  }

  private async recordMovement(
    manager: EntityManager,
    params: {
      dealerId: string;
      productId: string;
      warehouseId: string;
      movementType: StockMovementType;
      quantityDelta: number;
      referenceType?: string;
      referenceId?: string;
      userId?: string;
    },
  ): Promise<void> {
    const movement = manager.create(StockMovement, {
      dealer: { id: params.dealerId } as Dealer,
      product: { id: params.productId } as Product,
      warehouse: { id: params.warehouseId } as Warehouse,
      user: params.userId ? ({ id: params.userId } as User) : undefined,
      movementType: params.movementType,
      quantityDelta: params.quantityDelta,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
    });
    await manager.save(movement);
  }
}

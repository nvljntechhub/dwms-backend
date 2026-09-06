import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveGrnDto } from './dto/receive-grn.dto';
import { PurchaseOrderStatus } from 'src/common/utils/enums/purchase-order.enum';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { errorMessages } from 'src/utils/properties.utils';
import {
  assertTenantMatch,
  requireDealerId,
} from 'src/common/utils/tenant-scope.utils';
import { InventoryService } from 'src/inventory/inventory.service';
import { ManufacturersService } from 'src/manufacturers/manufacturers.service';
import { ProductsService } from 'src/products/products.service';
import { WarehousesService } from 'src/warehouses/warehouses.service';
import { lockEntityById } from 'src/common/utils/pessimistic-lock.utils';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  applySearchTerm,
  buildPaginatedResult,
  normalizePagination,
  orderItemsByIds,
  PaginatedResult,
} from 'src/common/utils/pagination.utils';
import {
  PurchaseOrderDetailView,
  PurchaseOrderListView,
  toPurchaseOrderDetail,
  toPurchaseOrderListItem,
} from './utils/map-purchase-order';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    private readonly inventoryService: InventoryService,
    private readonly manufacturersService: ManufacturersService,
    private readonly warehousesService: WarehousesService,
    private readonly productsService: ProductsService,
    private readonly dataSource: DataSource,
  ) {}

  private async assertOrderRefs(
    dto: CreatePurchaseOrderDto,
    dealerId: string,
  ): Promise<void> {
    await Promise.all([
      this.manufacturersService.findOne(dto.manufacturerId, dealerId),
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
  ): Promise<PurchaseOrder> {
    const locked = await lockEntityById(manager, PurchaseOrder, id);
    if (!locked) {
      throw new NotFoundException(errorMessages.PURCHASE_ORDER_NOT_FOUND);
    }
    assertTenantMatch(locked.dealerId, dealerId);

    const po = await manager.findOne(PurchaseOrder, { where: { id }, relations });
    if (!po) {
      throw new NotFoundException(errorMessages.PURCHASE_ORDER_NOT_FOUND);
    }

    return po;
  }

  async create(
    dto: CreatePurchaseOrderDto,
    dealerId?: string | null,
  ): Promise<PurchaseOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);
    await this.assertOrderRefs(dto, scopedDealerId);

    const purchaseOrder = this.purchaseOrderRepository.create({
      status: PurchaseOrderStatus.DRAFT,
      dealer: { id: scopedDealerId } as Dealer,
      manufacturer: { id: dto.manufacturerId },
      warehouse: { id: dto.warehouseId },
      items: dto.items.map((item) =>
        this.purchaseOrderItemRepository.create({
          product: { id: item.productId },
          quantityOrdered: item.quantityOrdered,
          quantityReceived: 0,
        }),
      ),
    });

    const saved = await this.purchaseOrderRepository.save(purchaseOrder);
    return this.findOne(saved.id, scopedDealerId);
  }

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<PurchaseOrderListView>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.purchaseOrderRepository
      .createQueryBuilder('po')
      .where('po.dealer_id = :dealerId', { dealerId: scopedDealerId });

    if (searchTerm) {
      qb.leftJoin('po.manufacturer', 'manufacturer')
        .leftJoin('po.warehouse', 'warehouse')
        .leftJoin('po.items', 'items')
        .leftJoin('items.product', 'product');
      applySearchTerm(
        qb,
        [
          'po.id',
          'CAST(po.status AS text)',
          'manufacturer.name',
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
      .select('po.id', 'id')
      .addSelect('po.createdAt')
      .distinct(true)
      .orderBy('po.createdAt', 'DESC')
      .offset(skip)
      .limit(limit)
      .getRawMany<{ id: string }>();

    if (!idRows.length) {
      return buildPaginatedResult([], total, page, limit);
    }

    const ids = idRows.map((row) => row.id);
    const items = await this.purchaseOrderRepository.find({
      where: { id: In(ids) },
      relations: ['manufacturer', 'warehouse', 'items'],
    });

    return buildPaginatedResult(
      orderItemsByIds(items, ids).map(toPurchaseOrderListItem),
      total,
      page,
      limit,
    );
  }

  private async loadOne(
    id: string,
    dealerId?: string | null,
  ): Promise<PurchaseOrder> {
    const scopedDealerId = requireDealerId(dealerId);
    const po = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['manufacturer', 'warehouse', 'items', 'items.product'],
    });

    if (!po) {
      throw new NotFoundException(errorMessages.PURCHASE_ORDER_NOT_FOUND);
    }

    assertTenantMatch(po.dealerId, scopedDealerId);
    return po;
  }

  async findOne(
    id: string,
    dealerId?: string | null,
  ): Promise<PurchaseOrderDetailView> {
    return toPurchaseOrderDetail(await this.loadOne(id, dealerId));
  }

  async submitOrder(
    id: string,
    dealerId?: string | null,
  ): Promise<PurchaseOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const po = await this.lockAndLoad(manager, id, scopedDealerId, [
        'manufacturer',
        'warehouse',
        'items',
        'items.product',
      ]);

      if (po.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException(errorMessages.INVALID_PO_STATUS_TRANSITION);
      }

      po.status = PurchaseOrderStatus.ORDERED;
      po.submittedAt = new Date();
      await manager.save(po);
      return toPurchaseOrderDetail(po);
    });
  }

  async receiveGrn(
    id: string,
    dto: ReceiveGrnDto,
    dealerId?: string | null,
    userId?: string,
  ): Promise<PurchaseOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const itemIds = dto.items.map((item) => item.itemId);
      if (new Set(itemIds).size !== itemIds.length) {
        throw new BadRequestException(errorMessages.GRN_DUPLICATE_ITEMS);
      }

      const po = await this.lockAndLoad(manager, id, scopedDealerId, [
        'items',
        'items.product',
      ]);

      if (
        po.status !== PurchaseOrderStatus.ORDERED &&
        po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(errorMessages.INVALID_PO_STATUS_TRANSITION);
      }

      for (const grnItem of dto.items) {
        const lineItem = po.items.find((item) => item.id === grnItem.itemId);
        if (!lineItem) {
          throw new NotFoundException(errorMessages.PO_ITEM_NOT_FOUND);
        }

        const remaining =
          lineItem.quantityOrdered - lineItem.quantityReceived;
        if (grnItem.quantityReceived > remaining) {
          throw new BadRequestException(errorMessages.GRN_QUANTITY_EXCEEDS_ORDER);
        }

        lineItem.quantityReceived += grnItem.quantityReceived;
        await manager.save(lineItem);

        await this.inventoryService.receiveStock(
          manager,
          lineItem.productId,
          po.warehouseId,
          scopedDealerId,
          grnItem.quantityReceived,
          po.id,
          userId,
        );
      }

      const allComplete = po.items.every(
        (item) => item.quantityReceived >= item.quantityOrdered,
      );
      const anyReceived = po.items.some((item) => item.quantityReceived > 0);

      let newStatus: PurchaseOrderStatus = po.status;
      if (allComplete) {
        newStatus = PurchaseOrderStatus.COMPLETED;
      } else if (anyReceived) {
        newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
      }

      await manager.update(PurchaseOrder, id, { status: newStatus });

      const updated = await manager.findOne(PurchaseOrder, {
        where: { id },
        relations: ['manufacturer', 'warehouse', 'items', 'items.product'],
      });

      return toPurchaseOrderDetail(updated as PurchaseOrder);
    });
  }

  async cancel(
    id: string,
    dealerId?: string | null,
  ): Promise<PurchaseOrderDetailView> {
    const scopedDealerId = requireDealerId(dealerId);

    return this.dataSource.transaction(async (manager) => {
      const po = await this.lockAndLoad(manager, id, scopedDealerId, [
        'manufacturer',
        'warehouse',
        'items',
        'items.product',
      ]);

      if (
        po.status === PurchaseOrderStatus.COMPLETED ||
        po.status === PurchaseOrderStatus.CANCELLED
      ) {
        throw new BadRequestException(errorMessages.INVALID_PO_STATUS_TRANSITION);
      }

      po.status = PurchaseOrderStatus.CANCELLED;
      await manager.save(po);
      return toPurchaseOrderDetail(po);
    });
  }
}

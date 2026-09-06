import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from 'src/inventory/inventory.service';
import { ManufacturersService } from 'src/manufacturers/manufacturers.service';
import { ProductsService } from 'src/products/products.service';
import { WarehousesService } from 'src/warehouses/warehouses.service';
import { errorMessages } from 'src/utils/properties.utils';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: {} },
        { provide: InventoryService, useValue: {} },
        { provide: ManufacturersService, useValue: {} },
        { provide: ProductsService, useValue: {} },
        { provide: WarehousesService, useValue: {} },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (callback) => callback({})),
          },
        },
      ],
    }).compile();

    service = module.get(PurchaseOrdersService);
  });

  it('rejects a GRN that repeats the same line item', async () => {
    await expect(
      service.receiveGrn(
        'po-1',
        {
          items: [
            { itemId: 'item-1', quantityReceived: 2 },
            { itemId: 'item-1', quantityReceived: 1 },
          ],
        },
        'dealer-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.receiveGrn(
        'po-1',
        {
          items: [
            { itemId: 'item-1', quantityReceived: 2 },
            { itemId: 'item-1', quantityReceived: 1 },
          ],
        },
        'dealer-1',
      ),
    ).rejects.toThrow(errorMessages.GRN_DUPLICATE_ITEMS);
  });
});

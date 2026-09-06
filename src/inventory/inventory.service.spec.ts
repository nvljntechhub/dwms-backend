import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { PurchaseOrder } from 'src/purchase-orders/entities/purchase-order.entity';
import { SalesOrder } from 'src/sales-orders/entities/sales-order.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { InventoryService } from './inventory.service';
import { errorMessages } from 'src/utils/properties.utils';

describe('InventoryService', () => {
  let service: InventoryService;
  let findOne: jest.Mock;
  let inventoryGetOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    inventoryGetOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Inventory), useValue: {} },
        { provide: getRepositoryToken(StockMovement), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(SalesOrder), useValue: {} },
        { provide: getRepositoryToken(Product), useValue: {} },
        { provide: getRepositoryToken(Warehouse), useValue: {} },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (callback) =>
              callback({
                findOne,
                getRepository: () => ({
                  createQueryBuilder: () => ({
                    setLock: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    andWhere: jest.fn().mockReturnThis(),
                    getOne: inventoryGetOne,
                  }),
                }),
                save: jest.fn(),
                create: jest.fn(),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  it('rejects an adjustment that would drop on-hand below allocated', async () => {
    findOne.mockImplementation(async (_entity, options) => {
      if (options?.where?.id === 'p1') {
        return { id: 'p1', dealerId: 'dealer-1' };
      }
      if (options?.where?.id === 'wh-1') {
        return { id: 'wh-1', dealerId: 'dealer-1' };
      }
      return null;
    });
    inventoryGetOne.mockResolvedValue({
      id: 'inv-1',
      dealerId: 'dealer-1',
      quantityOnHand: 5,
      quantityAllocated: 4,
    });

    await expect(
      service.adjust(
        { productId: 'p1', warehouseId: 'wh-1', quantityDelta: -2 },
        'dealer-1',
      ),
    ).rejects.toThrow(errorMessages.ADJUSTMENT_BELOW_ALLOCATED);
  });
});

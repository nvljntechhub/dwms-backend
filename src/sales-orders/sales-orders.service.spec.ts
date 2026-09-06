import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { Shop } from 'src/shops/entities/shop.entity';
import { SalesOrdersService } from './sales-orders.service';
import { InventoryService } from 'src/inventory/inventory.service';
import { ShopsService } from 'src/shops/shops.service';
import { WarehousesService } from 'src/warehouses/warehouses.service';
import { ProductsService } from 'src/products/products.service';
import { DealersService } from 'src/dealers/dealers.service';
import { SalesOrderStatus } from 'src/common/utils/enums/sales-order.enum';
import { errorMessages } from 'src/utils/properties.utils';

describe('SalesOrdersService', () => {
  let service: SalesOrdersService;
  let shopsService: { findOne: jest.Mock };
  let warehousesService: { findOne: jest.Mock };
  let productsService: { assertOwned: jest.Mock };
  let lockGetOne: jest.Mock;
  let managerFindOne: jest.Mock;

  beforeEach(async () => {
    shopsService = { findOne: jest.fn() };
    warehousesService = { findOne: jest.fn() };
    productsService = { assertOwned: jest.fn() };
    lockGetOne = jest.fn();
    managerFindOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrdersService,
        { provide: getRepositoryToken(SalesOrder), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(SalesOrderItem), useValue: { create: jest.fn() } },
        { provide: getRepositoryToken(Shop), useValue: {} },
        { provide: InventoryService, useValue: {} },
        { provide: ShopsService, useValue: shopsService },
        { provide: WarehousesService, useValue: warehousesService },
        { provide: ProductsService, useValue: productsService },
        { provide: DealersService, useValue: { getCurrency: jest.fn() } },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (callback) =>
              callback({
                getRepository: () => ({
                  createQueryBuilder: () => ({
                    setLock: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    getOne: lockGetOne,
                  }),
                }),
                findOne: managerFindOne,
                save: jest.fn(),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(SalesOrdersService);
  });

  it('rejects create when a product is not owned by the dealer', async () => {
    shopsService.findOne.mockResolvedValue({ id: 'shop-1' });
    warehousesService.findOne.mockResolvedValue({ id: 'wh-1' });
    productsService.assertOwned.mockRejectedValue(
      new NotFoundException(errorMessages.PRODUCT_NOT_FOUND),
    );

    await expect(
      service.create(
        {
          shopId: 'shop-1',
          warehouseId: 'wh-1',
          items: [{ productId: 'foreign-product', quantity: 1, unitPrice: 10 }],
        },
        'dealer-1',
      ),
    ).rejects.toThrow(errorMessages.PRODUCT_NOT_FOUND);
  });

  it('does not cancel a shipped sales order', async () => {
    const shipped = {
      id: 'so-1',
      dealerId: 'dealer-1',
      status: SalesOrderStatus.SHIPPED,
      items: [],
    };
    lockGetOne.mockResolvedValue(shipped);
    managerFindOne.mockResolvedValue(shipped);

    await expect(service.cancel('so-1', 'dealer-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.cancel('so-1', 'dealer-1')).rejects.toThrow(
      errorMessages.INVALID_SO_STATUS_TRANSITION,
    );
  });
});

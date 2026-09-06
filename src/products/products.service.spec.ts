import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Manufacturer } from 'src/manufacturers/entities/manufacturer.entity';
import { DealersService } from 'src/dealers/dealers.service';
import { ProductsService } from './products.service';
import { errorMessages } from 'src/utils/properties.utils';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    productRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: getRepositoryToken(Manufacturer), useValue: {} },
        { provide: DealersService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('assertOwned', () => {
    it('passes when every product belongs to the dealer', async () => {
      productRepository.find.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

      await expect(
        service.assertOwned(['p1', 'p2', 'p1'], 'dealer-1'),
      ).resolves.toBeUndefined();
    });

    it('throws when a product is missing or belongs to another dealer', async () => {
      productRepository.find.mockResolvedValue([{ id: 'p1' }]);

      await expect(
        service.assertOwned(['p1', 'p2'], 'dealer-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.assertOwned(['p1', 'p2'], 'dealer-1'),
      ).rejects.toThrow(errorMessages.PRODUCT_NOT_FOUND);
    });
  });

  describe('findAll availableOnly', () => {
    it('scopes available stock to the requested warehouse', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      productRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('dealer-1', {
        availableOnly: true,
        warehouseId: 'wh-1',
        page: 1,
        limit: 25,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('AND inventory.warehouse_id = :warehouseId'),
        { warehouseId: 'wh-1' },
      );
    });
  });
});

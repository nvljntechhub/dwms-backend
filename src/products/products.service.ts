import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { DealersService } from 'src/dealers/dealers.service';
import { Manufacturer } from 'src/manufacturers/entities/manufacturer.entity';
import { errorMessages } from 'src/utils/properties.utils';
import {
  assertTenantMatch,
  requireDealerId,
} from 'src/common/utils/tenant-scope.utils';
import { compactCsvRow, parseProductCsv } from './utils/parse-product-csv';
import { ProductsQueryDto } from './dto/products-query.dto';
import {
  applySearchTerm,
  buildPaginatedResult,
  normalizePagination,
  PaginatedResult,
} from 'src/common/utils/pagination.utils';

const MAX_BULK_PRODUCTS = 1000;

function flattenValidationErrors(errors: ValidationError[]): string {
  return errors
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .join(', ');
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Manufacturer)
    private readonly manufacturerRepository: Repository<Manufacturer>,
    private readonly dealersService: DealersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateProductDto,
    dealerId?: string | null,
  ): Promise<Product> {
    const scopedDealerId = requireDealerId(dealerId);
    const currency = await this.dealersService.getCurrency(scopedDealerId);
    const product = this.productRepository.create({
      ...dto,
      currency,
      manufacturer: dto.manufacturerId
        ? ({ id: dto.manufacturerId } as Product['manufacturer'])
        : undefined,
      dealer: { id: scopedDealerId } as Dealer,
    });
    return this.productRepository.save(product);
  }

  async createFromBody(
    body: Record<string, unknown>,
    dealerId?: string | null,
  ): Promise<Product> {
    const dto = plainToInstance(CreateProductDto, body ?? {}, {
      enableImplicitConversion: true,
    });
    const validationErrors = await validate(dto, { whitelist: true });

    if (validationErrors.length) {
      throw new BadRequestException(
        validationErrors.flatMap((error) =>
          Object.values(error.constraints ?? {}),
        ),
      );
    }

    return this.create(dto, dealerId);
  }

  async createBulkFromCsv(
    file: Express.Multer.File,
    dealerId?: string | null,
  ): Promise<Product[]> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(errorMessages.PRODUCT_CSV_REQUIRED);
    }

    const scopedDealerId = requireDealerId(dealerId);
    const rows = parseProductCsv(file.buffer);

    if (rows.length > MAX_BULK_PRODUCTS) {
      throw new BadRequestException(errorMessages.PRODUCT_CSV_TOO_MANY_ROWS);
    }

    const rowErrors: string[] = [];
    const dtos: { rowNumber: number; dto: CreateProductDto }[] = [];
    const seenSkus = new Map<string, number>();

    for (const row of rows) {
      const dto = plainToInstance(CreateProductDto, compactCsvRow(row.values), {
        enableImplicitConversion: true,
      });
      const validationErrors = await validate(dto, { whitelist: true });

      if (validationErrors.length) {
        rowErrors.push(
          `Row ${row.rowNumber}: ${flattenValidationErrors(validationErrors)}`,
        );
        continue;
      }

      const skuKey = dto.sku.trim().toLowerCase();
      const duplicateRow = seenSkus.get(skuKey);
      if (duplicateRow !== undefined) {
        rowErrors.push(
          `Row ${row.rowNumber}: Duplicate SKU "${dto.sku}" also appears on row ${duplicateRow}`,
        );
        continue;
      }

      seenSkus.set(skuKey, row.rowNumber);
      dtos.push({ rowNumber: row.rowNumber, dto });
    }

    if (dtos.length) {
      const existing = await this.productRepository
        .createQueryBuilder('product')
        .select('product.sku', 'sku')
        .where('product.dealer_id = :dealerId', { dealerId: scopedDealerId })
        .andWhere('LOWER(product.sku) IN (:...skus)', {
          skus: dtos.map(({ dto }) => dto.sku.toLowerCase()),
        })
        .getRawMany<{ sku: string }>();
      const existingSkus = new Set(
        existing.map((product) => product.sku.toLowerCase()),
      );

      for (const item of dtos) {
        if (existingSkus.has(item.dto.sku.toLowerCase())) {
          rowErrors.push(
            `Row ${item.rowNumber}: ${errorMessages.PRODUCT_SKU_EXISTS} (${item.dto.sku})`,
          );
        }
      }

      const manufacturerIds = [
        ...new Set(
          dtos
            .map(({ dto }) => dto.manufacturerId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      if (manufacturerIds.length) {
        const manufacturers = await this.manufacturerRepository.find({
          where: {
            id: In(manufacturerIds),
            dealer: { id: scopedDealerId },
          },
          select: ['id'],
        });
        const foundIds = new Set(manufacturers.map((item) => item.id));

        for (const item of dtos) {
          if (
            item.dto.manufacturerId &&
            !foundIds.has(item.dto.manufacturerId)
          ) {
            rowErrors.push(
              `Row ${item.rowNumber}: ${errorMessages.MANUFACTURER_NOT_FOUND}`,
            );
          }
        }
      }
    }

    if (rowErrors.length) {
      throw new BadRequestException(rowErrors);
    }

    const currency = await this.dealersService.getCurrency(scopedDealerId);

    return this.dataSource.transaction(async (manager) => {
      const products = dtos.map(({ dto }) =>
        manager.create(Product, {
          ...dto,
          currency,
          manufacturer: dto.manufacturerId
            ? ({ id: dto.manufacturerId } as Product['manufacturer'])
            : undefined,
          dealer: { id: scopedDealerId } as Dealer,
        }),
      );
      return manager.save(products);
    });
  }

  async findAll(
    dealerId?: string | null,
    query: ProductsQueryDto = {},
  ): Promise<PaginatedResult<Product>> {
    const scopedDealerId = requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.manufacturer', 'manufacturer')
      .where('product.dealer_id = :dealerId', { dealerId: scopedDealerId })
      .orderBy('product.createdAt', 'DESC');

    if (query.availableOnly) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM inventory inventory
          WHERE inventory.product_id = product.id
            AND inventory.dealer_id = :dealerId
            AND inventory.quantity_on_hand - inventory.quantity_allocated > 0
            ${query.warehouseId ? 'AND inventory.warehouse_id = :warehouseId' : ''}
        )`,
        query.warehouseId ? { warehouseId: query.warehouseId } : {},
      );
    }

    applySearchTerm(qb, [
      'product.sku',
      'product.name',
      'product.barcode',
      'product.categoryId',
      'manufacturer.name',
    ], searchTerm);

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return buildPaginatedResult(items, total, page, limit);
  }

  async assertOwned(ids: string[], dealerId: string): Promise<void> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) {
      return;
    }

    const found = await this.productRepository.find({
      where: { id: In(uniqueIds), dealer: { id: dealerId } },
      select: ['id'],
    });

    if (found.length !== uniqueIds.length) {
      throw new NotFoundException(errorMessages.PRODUCT_NOT_FOUND);
    }
  }

  async findOne(id: string, dealerId?: string | null): Promise<Product> {
    const scopedDealerId = requireDealerId(dealerId);
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['manufacturer'],
    });

    if (!product) {
      throw new NotFoundException(errorMessages.PRODUCT_NOT_FOUND);
    }

    assertTenantMatch(product.dealerId, scopedDealerId);
    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    dealerId?: string | null,
  ): Promise<Product> {
    await this.findOne(id, dealerId);
    const { manufacturerId, ...rest } = dto;
    const updatePayload: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );

    if (manufacturerId !== undefined) {
      updatePayload.manufacturer = manufacturerId
        ? { id: manufacturerId }
        : null;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.productRepository.save({ id, ...updatePayload });
    }

    return this.findOne(id, dealerId);
  }

  async remove(id: string, dealerId?: string | null): Promise<void> {
    await this.findOne(id, dealerId);
    await this.productRepository.delete(id);
  }

  async countByDealer(dealerId: string): Promise<number> {
    return this.productRepository.count({
      where: { dealer: { id: dealerId } },
    });
  }
}

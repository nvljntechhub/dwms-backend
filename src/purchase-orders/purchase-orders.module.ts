import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { AuthModule } from 'src/auth/auth.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { ManufacturersModule } from 'src/manufacturers/manufacturers.module';
import { ProductsModule } from 'src/products/products.module';
import { WarehousesModule } from 'src/warehouses/warehouses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderItem]),
    AuthModule,
    InventoryModule,
    ManufacturersModule,
    ProductsModule,
    WarehousesModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService, TypeOrmModule],
})
export class PurchaseOrdersModule {}

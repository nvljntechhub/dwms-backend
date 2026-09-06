import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { SalesOrdersService } from './sales-orders.service';
import { SalesOrdersController } from './sales-orders.controller';
import { AuthModule } from 'src/auth/auth.module';
import { DealersModule } from 'src/dealers/dealers.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { ProductsModule } from 'src/products/products.module';
import { ShopsModule } from 'src/shops/shops.module';
import { WarehousesModule } from 'src/warehouses/warehouses.module';
import { Shop } from 'src/shops/entities/shop.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesOrder, SalesOrderItem, Shop]),
    AuthModule,
    DealersModule,
    InventoryModule,
    ProductsModule,
    ShopsModule,
    WarehousesModule,
  ],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService, TypeOrmModule],
})
export class SalesOrdersModule {}

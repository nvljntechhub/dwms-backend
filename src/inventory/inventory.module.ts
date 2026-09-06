import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entities/inventory.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PurchaseOrder } from 'src/purchase-orders/entities/purchase-order.entity';
import { SalesOrder } from 'src/sales-orders/entities/sales-order.entity';
import { Product } from 'src/products/entities/product.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inventory,
      StockMovement,
      PurchaseOrder,
      SalesOrder,
      Product,
      Warehouse,
    ]),
    AuthModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule {}

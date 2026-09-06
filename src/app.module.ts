import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ormConfig } from 'src/config/ormConfig';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { RedisModule } from './redis/redis.module';
import { DealersModule } from './dealers/dealers.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { ManufacturersModule } from './manufacturers/manufacturers.module';
import { ShopsModule } from './shops/shops.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SalesOrdersModule } from './sales-orders/sales-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: ormConfig,
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    MailModule,
    RedisModule,
    DealersModule,
    WarehousesModule,
    ManufacturersModule,
    ShopsModule,
    ProductsModule,
    InventoryModule,
    PurchaseOrdersModule,
    SalesOrdersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

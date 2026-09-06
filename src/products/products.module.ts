import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from 'src/auth/auth.module';
import { DealersModule } from 'src/dealers/dealers.module';
import { ManufacturersModule } from 'src/manufacturers/manufacturers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    AuthModule,
    DealersModule,
    ManufacturersModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}

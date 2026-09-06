import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './entities/shop.entity';
import { ShopsService } from './shops.service';
import { ShopsController } from './shops.controller';
import { AuthModule } from 'src/auth/auth.module';
import { DealersModule } from 'src/dealers/dealers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shop]), AuthModule, DealersModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService, TypeOrmModule],
})
export class ShopsModule {}

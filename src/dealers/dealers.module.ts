import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dealer } from './entities/dealer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dealer])],
  exports: [TypeOrmModule],
})
export class DealersModule {}

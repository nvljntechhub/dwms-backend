import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dealer } from './entities/dealer.entity';
import { DealersService } from './dealers.service';
import { DealersController } from './dealers.controller';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis/redis.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dealer]),
    AuthModule,
    RedisModule,
    MailModule,
  ],
  controllers: [DealersController],
  providers: [DealersService],
  exports: [DealersService, TypeOrmModule],
})
export class DealersModule {}

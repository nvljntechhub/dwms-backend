import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import { MailModule } from 'src/mail/mail.module';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from 'src/redis/redis.module';
import { DealersModule } from 'src/dealers/dealers.module';
import { WarehousesModule } from 'src/warehouses/warehouses.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ACCESS_JWT, REFRESH_JWT } from './jwt.constants';
import type { SignOptions } from 'jsonwebtoken';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Dealer, Warehouse]),
    DealersModule,
    WarehousesModule,
    RedisModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    {
      provide: ACCESS_JWT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtService({
          secret: config.get<string>('ACCESS_TOKEN_SECRET'),
          signOptions: {
            expiresIn: config.get<string>(
              'ACCESS_TOKEN_EXPIRED_IN',
              '15m',
            ) as SignOptions['expiresIn'],
          },
        }),
    },
    {
      provide: REFRESH_JWT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtService({
          secret: config.get<string>('REFRESH_TOKEN_SECRET'),
          signOptions: {
            expiresIn: config.get<string>(
              'REFRESH_TOKEN_EXPIRED_IN',
              '7d',
            ) as SignOptions['expiresIn'],
          },
        }),
    },
  ],
  exports: [ACCESS_JWT, JwtAuthGuard, TypeOrmModule],
})
export class AuthModule {}

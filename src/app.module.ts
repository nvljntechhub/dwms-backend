import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ormConfig } from 'src/config/ormConfig';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { UserAddressesModule } from './user-addresses/user-addresses.module';
import { RedisModule } from './redis/redis.module';

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
    UserAddressesModule,
    RedisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

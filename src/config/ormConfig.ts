import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const ormConfig = async (
  configService: ConfigService,
): Promise<TypeOrmModuleOptions> => ({
  name: 'dwmsDb',
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: 5432,
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_DATABASE'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  autoLoadEntities: true,
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
});

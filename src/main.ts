import * as crypto from 'crypto';
if (!globalThis.crypto) {
  (globalThis as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  isAllowedCorsOrigin,
  parseAllowedOrigins,
} from './common/utils/cors.utils';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins = parseAllowedOrigins(
    configService.get<string>('FRONTEND_URL'),
  );
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin, allowedOrigins, isProduction)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });
  await app.listen(configService.get<number>('PORT'), '0.0.0.0');
}
bootstrap();

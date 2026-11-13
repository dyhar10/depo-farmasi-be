import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.config';
import { Rfc7807ExceptionFilter } from './common/filters/rfc7807-exception.filter';
import { logger } from './infrastructure/logger/pino.logger';

// Use direct CommonJS require to avoid (0, cookie_parser_1.default) is not a function
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(cookieParser());

  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new Rfc7807ExceptionFilter());

  // Setup Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Depo Farmasi API')
    .setDescription('API Pengadaan dan Pengelolaan Barang Depo Farmasi (Obat dan BMHP)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(env.PORT);
  logger.info(`Aplikasi Depo Farmasi berjalan di port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Aplikasi gagal dijalankan');
  process.exit(1);
});
